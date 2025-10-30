# Dev Null Service

`devnull-svc` is the tutor-provided Azure Functions receiver for Week 7.
It accepts a Product update, logs the validated payload and discards it,
returning `202 Accepted`. The calling backend supplies this receiving
Function App's ordinary host key when calling the deployed receiver.

Follow the Week 7 worksheet for the ordered lab. Use this README for the
receiver steps in Part B and as an endpoint reference during Parts C–D.

## Development environment

Start Docker and wait for its engine to be running before opening VS Code.
Check that VS Code has the Dev Containers extension and sign in to GitHub.
Follow the Week 5–6 private-copy workflow, preserving the upstream history:

1. In VS Code, open the Command Palette (**Ctrl+Shift+P** on Windows/Linux or
   **Cmd+Shift+P** on macOS) and choose **Git: Clone**.
2. Enter `https://github.com/tpdavison/devnull-svc.git` and choose a local parent
   folder for the clone.
3. When cloning finishes, choose **Open** to open the cloned repository in VS Code.
4. Open the Command Palette and choose **Dev Containers: Reopen in Container**.
   Wait for the container setup to finish, then open a terminal in VS Code.

Create an empty **private**
GitHub repository named `devnull-svc`, without a README, licence or `.gitignore`.
In the container terminal, replace `YOUR_GITHUB_USERNAME` below:

```bash
git remote set-url origin https://github.com/YOUR_GITHUB_USERNAME/devnull-svc.git
git remote -v
git branch --show-current
```

Confirm that the branch is `main` and both remote URLs point to your private
repository, then push the existing history:

```bash
git push -u origin main
```

Check that GitHub shows the project history in your private repository.

If you already have a private copy, continue in that copy. Keep its history;
do not initialise a new repository or create a public fork.

Run the remaining Bash commands from this repository's root in the Dev
Container, including on Windows. The repository uses the course
`ghcr.io/tpdavison/devops-labs:2026-latest` image, Node.js 22, Azure Functions
runtime/Core Tools 4 and TypeScript 7. Check the available tools and restore the
committed dependency versions:

```bash
node --version
npm --version
func --version
az version
npm ci
```

## Local setup and receiver check

Copy the non-secret local settings template once. Skip this copy if you already
have `local.settings.json`:

```bash
cp local.settings.template.json local.settings.json
```

Check the types, then build. Resolve any error before continuing:

```bash
npm run typecheck
```

```bash
npm run build
```

When both succeed, start the local host:

```bash
npm start
```

`npm start` cleans and rebuilds `dist/` before starting the Functions host.
The app loads compiled handlers from `dist/src/functions/*.js`.
`npm test` is a placeholder that exits with status 1; no automated test suite
is supplied for this exercise.

Leave the host running. In a second container terminal, from the repository
root, send the supplied sample:

```bash
curl -i http://localhost:7071/api/product-updated \
  -H 'Content-Type: application/json' \
  --data-binary @samples/post-product-updated.json
```

This POST sends no key. Expect `202` with `{"message":"accepted"}`. In the host
terminal, find `Product updated:` followed by the validated sample, including
`prod_001`. Stop the local host with Ctrl+C when finished.

The receiver is registered with `authLevel: 'function'`. The local Functions
host normally bypasses key enforcement; a successful local request without a
key does not demonstrate the deployed security boundary. In worksheet B3,
compare missing, wrong and correct keys after deployment using the checks below.

## Deploy to Azure

### Select the subscription and resource names

In the receiver Dev Container, sign in to Azure and list your subscriptions:

```bash
az login
```

```bash
az account list --query '[].{Name:name,Id:id,IsDefault:isDefault}' --output table
```

If the current selection differs from your Azure subscription, such as your
Azure for Students subscription, enter its ID from the list and select it:

```bash
AZURE_SUBSCRIPTION_ID='YOUR_SUBSCRIPTION_ID'
az account set --subscription "$AZURE_SUBSCRIPTION_ID"
```

Confirm the active subscription before creating resources:

```bash
az account show --query '{Name:name,Id:id}' --output table
```

Continue only when the name and ID match your intended subscription. Obtain
the subscription ID from Azure rather than copying someone else's value.

Choose a short personal identifier using lowercase letters and digits. Replace
`YOUR_UID` in the names below and choose a region permitted for your subscription.
Use the course's `project-env-uid-type` naming convention. Function App and
storage account names must be globally unique. Join storage name components
without separators, using 3–24 lowercase letters or digits after substitution.

```bash
WEEK7_RESOURCE_GROUP='week7-lab-YOUR_UID-rg'
WEEK7_REGION='YOUR_PERMITTED_REGION'
RECEIVER_APP_NAME='receiver-lab-YOUR_UID-func'
RECEIVER_STORAGE_ACCOUNT='week7labYOUR_UIDstore'
```

This disposable Week 7 group holds both Function Apps, each with its own storage
account. Retain the group, region and receiver app name for Part C. Enter the
same `WEEK7_RESOURCE_GROUP` and `WEEK7_REGION` values in the caller Dev Container;
the caller reuses this group and creates separate app and storage resources.

These Bash variables belong to the current terminal. In a fresh terminal,
re-enter the resource values and confirm the active subscription before Azure
work; retrieve the key again only when a later step needs it.

### Create the receiver resources

The Week 7 route uses Windows Consumption, Functions 4 and Node.js 22.
The course Dev Container remains the build environment. Run each command in
order and resolve any failure before continuing.

Create the shared Week 7 resource group here:

```bash
az group create \
  --name "$WEEK7_RESOURCE_GROUP" \
  --location "$WEEK7_REGION" \
  --output none
```

Create the receiver's storage account in that group:

```bash
az storage account create \
  --name "$RECEIVER_STORAGE_ACCOUNT" \
  --resource-group "$WEEK7_RESOURCE_GROUP" \
  --location "$WEEK7_REGION" \
  --sku Standard_LRS \
  --kind StorageV2 \
  --output none
```

Create the receiver Function App:

```bash
az functionapp create \
  --name "$RECEIVER_APP_NAME" \
  --resource-group "$WEEK7_RESOURCE_GROUP" \
  --storage-account "$RECEIVER_STORAGE_ACCOUNT" \
  --consumption-plan-location "$WEEK7_REGION" \
  --os-type Windows \
  --runtime node \
  --runtime-version 22 \
  --functions-version 4 \
  --https-only true \
  --output none
```

Check the runtime settings:

```bash
az functionapp config appsettings list \
  --name "$RECEIVER_APP_NAME" \
  --resource-group "$WEEK7_RESOURCE_GROUP" \
  --query "[?name=='FUNCTIONS_WORKER_RUNTIME' || name=='WEBSITE_NODE_DEFAULT_VERSION'].{Setting:name,Value:value}" \
  --output table
```

Expect `FUNCTIONS_WORKER_RUNTIME` to be `node` and
`WEBSITE_NODE_DEFAULT_VERSION` to select Node.js 22 (for example, `~22`).
If these differ, check the app name and creation options before publishing.
If the subscription or region rejects resource creation, check the course's
permitted deployment settings before proceeding.

### Publish and discover the hostname

Build the receiver and resolve any error before publishing:

```bash
npm run build
```

After the build succeeds, publish from the same terminal:

```bash
func azure functionapp publish "$RECEIVER_APP_NAME" --no-build
```

Stop if publication fails. Do not use
`--publish-local-settings`; the receiver needs no application key in its local
settings. Retrieve the app's actual hostname rather than constructing it from
the resource name:

```bash
az functionapp show \
  --name "$RECEIVER_APP_NAME" \
  --resource-group "$WEEK7_RESOURCE_GROUP" \
  --query defaultHostName --output tsv
```

Stop if retrieval fails, is empty or returns `None`; check the app name, group
and active subscription before retrying. Enter the returned hostname below,
without `https://` or a path. Form the full endpoint by adding `https://` and
`/api/product-updated`:

```bash
RECEIVER_HOSTNAME='YOUR_RECEIVER_HOSTNAME'
RECEIVER_URL="https://${RECEIVER_HOSTNAME}/api/product-updated"
```

Use this full URL for the caller's `PRODUCT_UPDATED_ENDPOINT` in worksheet C1.

### Retrieve an ordinary host key

Capture the ordinary host key named `default` directly into a Bash
variable, without printing it:

```bash
RECEIVER_HOST_KEY=$(az functionapp keys list \
  --name "$RECEIVER_APP_NAME" \
  --resource-group "$WEEK7_RESOURCE_GROUP" \
  --query functionKeys.default --output tsv)
```

After the lookup succeeds, check that the key is present without displaying it:

```bash
test -n "$RECEIVER_HOST_KEY" &&
  test "$RECEIVER_HOST_KEY" != None &&
  echo "Key retrieved"
```

Continue only when the lookup succeeds and the check prints `Key retrieved`.
If either fails, confirm deployment completed and check the app, group and
active subscription before retrieving the key again. The `curl` commands below
expand the variable in this shell, so no separate export is needed.

A host key can call functions protected with `authLevel: 'function'` throughout
its Function App. A function-scoped key limits access to one function. The
administrative `_master` key is not appropriate for routine application calls;
do not retrieve or distribute it for this exercise.

Keep the key in shell variables locally and appropriate Azure
application settings in the calling backend when deployed. Do not put it in
repository files, SPA `VITE_*` values, screenshots or literal command examples.
Avoid shell tracing (`set -x`) and verbose HTTP output that could expose it.
Refer to Week 5 for assessment configuration practice.

## Verify deployed key enforcement

Run these from the same container terminal where the receiver variables are
set. Each request uses the same valid sample, so the key is the changing input.

Missing key — expect `401 Unauthorized`:

```bash
curl -i "$RECEIVER_URL" \
  -H 'Content-Type: application/json' \
  --data-binary @samples/post-product-updated.json
```

Incorrect key — expect `401 Unauthorized`:

```bash
curl -i "$RECEIVER_URL" \
  -H 'Content-Type: application/json' \
  -H 'x-functions-key: deliberately-invalid-key' \
  --data-binary @samples/post-product-updated.json
```

Correct ordinary host key — expect `202 Accepted` and
`{"message":"accepted"}`:

```bash
curl -i "$RECEIVER_URL" \
  -H 'Content-Type: application/json' \
  -H "x-functions-key: ${RECEIVER_HOST_KEY}" \
  --data-binary @samples/post-product-updated.json
```

In the Azure portal, open the receiver Function App, then **Functions →
product-updated-http → Invocations** (worksheet B4). Refresh until the accepted
call appears; invocation history can take a few minutes to update. Open the
matching **Date (UTC)** entry for your request time and find `Product updated:`
with the sample Product ID `prod_001`. The denied requests should not reach
the handler. Keep evidence free of credentials.

If the accepted invocation is missing, check the app, time range and that
Application Insights is linked to the receiver. Refresh and ask your tutor if
it remains missing.

A `404` suggests the wrong hostname, route or an incomplete deployment. Check
that the URL ends in `/api/product-updated`. If the correct
key returns `401`, confirm that it belongs to this receiving Function App and
retrieve it again. Do not substitute an administrative key.
For a receiver `500`, inspect the invocation logs or the receiver Function App's
Log stream for errors at the request time.

## Endpoints

`host.json` retains the default `/api` route prefix. The current registrations
expose these endpoints locally and after deployment:

| Method | Path                   | Deployed authentication     | Successful response                                                     |
| ------ | ---------------------- | --------------------------- | ----------------------------------------------------------------------- |
| `POST` | `/api/product-updated` | Host or function-scoped key | `202` with `{"message":"accepted"}`                                     |
| `GET`  | `/api/health`          | Anonymous                   | `200` with `{"status":"healthy","timestamp":"<current ISO timestamp>"}` |

The health endpoint is a basic liveness response; it does not verify key
enforcement or downstream delivery.

## Receiver contract and backend caller

- Method: `POST`.
- Path: `/api/product-updated`.
- Authentication: an ordinary host key supplied in `x-functions-key` for deployed calls.
- Valid payload: `202` with `{"message":"accepted"}` and a logged Product update.
- Invalid JSON: `400` with `{"error":"Invalid JSON body"}`.
- Invalid fields: `400` with `{"error":"ValidationError","details":[...]}`.

The JSON body contains:

```json
{
  "id": "prod_001",
  "name": "Super Widget",
  "pricePence": 1299,
  "description": "A versatile widget for demos and tests",
  "updatedAt": "2025-10-30T12:00:00.000Z"
}
```

`id` and `name` must be non-empty strings; `pricePence` must be a non-negative
integer; `description` must be a string; `updatedAt` must match the canonical
ISO format produced by `Date.toISOString()`. The sample is in
`samples/post-product-updated.json`.

## Clean-up

Keep the receiver available through the backend caller and SPA checks in
Parts C–D. After completing those checks, follow worksheet F1 for shared Azure
clean-up. Confirm the active subscription, inspect all resources in
`WEEK7_RESOURCE_GROUP` and confirm that every resource is disposable before
deleting the shared group once. This removes both Function Apps and their
storage accounts. Verify that `az group exists --name "$WEEK7_RESOURCE_GROUP"`
returns `false`.

For worksheet F2, clear the key in every receiver shell where you set it:

```bash
unset RECEIVER_HOST_KEY
```
