import { and, eq } from "drizzle-orm";

import { eventRoutingRuleTable, workflowTable } from "lib/db/schema";
import haloOrderConfirmed from "./haloOrderConfirmed.workflow.json";

/**
 * System event-triggered workflow definitions seeded on startup.
 * These run under the platform organization and are triggered by CloudEvents
 * routed through the event routing rule table.
 */
const eventWorkflows = [
  {
    name: "gatekeeper-email-send",
    description:
      "Render and send transactional emails triggered by Gatekeeper email events",
    definition: {
      version: "1.0",
      executor: "temporal",
      settings: {
        timeout: "2m",
        retryPolicy: {
          maxAttempts: 3,
          backoffCoefficient: 2,
          initialInterval: "1s",
          maxInterval: "30s",
        },
      },
      edges: [],
      steps: [
        {
          id: "trigger",
          type: "trigger",
          name: "Email Requested",
          position: { x: 0, y: 0 },
          trigger: {
            type: "event",
            config: {
              pattern: "gatekeeper.email.*",
              source: "omni.gatekeeper",
            },
          },
          next: "check-suppression",
        },
        {
          id: "check-suppression",
          type: "code",
          name: "Check Suppression List",
          position: { x: 0, y: 100 },
          code: {
            sandbox: "worker",
            inputs: {
              to: "{{ steps['trigger'].output.event.data.to }}",
              templateId: "{{ steps['trigger'].output.event.data.templateId }}",
              templateData:
                "{{ steps['trigger'].output.event.data.templateData }}",
              senderAddress:
                "{{ steps['trigger'].output.event.data.senderAddress }}",
            },
            source:
              "const { to, templateId, templateData, senderAddress } = input;\nreturn { suppressed: false, to, templateId, templateData, senderAddress };",
          },
          next: "check-not-suppressed",
        },
        {
          id: "check-not-suppressed",
          type: "condition",
          name: "Suppressed?",
          position: { x: 0, y: 200 },
          condition: {
            expression:
              "{{ steps['check-suppression'].output.suppressed === true }}",
            trueBranch: "end-suppressed",
            falseBranch: "render",
          },
        },
        {
          id: "render",
          type: "code",
          name: "Render Email Template",
          position: { x: 0, y: 300 },
          code: {
            sandbox: "worker",
            inputs: {
              templateId: "{{ steps['check-suppression'].output.templateId }}",
              templateData:
                "{{ steps['check-suppression'].output.templateData }}",
              gatekeeperApiUrl: "{{ env.AUTH_API_URL }}",
              emailRenderSecret: "{{ env.EMAIL_RENDER_SECRET }}",
            },
            source:
              "const { templateId, templateData, gatekeeperApiUrl, emailRenderSecret } = input;\nconst res = await fetch(`${gatekeeperApiUrl}/api/email/render`, {\n  method: 'POST',\n  headers: {\n    'Content-Type': 'application/json',\n    'Authorization': `Bearer ${emailRenderSecret}`\n  },\n  body: JSON.stringify({ templateId, templateData })\n});\nif (!res.ok) throw new Error(`Render failed: ${res.status}`);\nconst json = await res.json();\nreturn { html: json.html, subject: json.subject };",
          },
          next: "send",
        },
        {
          id: "send",
          type: "code",
          name: "Send via Herald",
          position: { x: 0, y: 400 },
          code: {
            sandbox: "worker",
            inputs: {
              to: "{{ steps['check-suppression'].output.to }}",
              senderAddress:
                "{{ steps['check-suppression'].output.senderAddress }}",
              html: "{{ steps.render.output.html }}",
              subject: "{{ steps.render.output.subject }}",
              heraldUrl: "{{ env.HERALD_API_URL }}",
              heraldKey: "{{ env.HERALD_API_KEY }}",
              heraldSender: "{{ env.HERALD_SENDER_EMAIL_ADDRESS }}",
            },
            source:
              "const { to, senderAddress, html, subject, heraldUrl, heraldKey, heraldSender } = input;\nif (!heraldUrl || !heraldKey) throw new Error('Herald not configured');\nconst from = senderAddress || heraldSender || 'noreply@send.omni.dev';\nconst res = await fetch(`${heraldUrl}/messages`, {\n  method: 'POST',\n  headers: {\n    'Content-Type': 'application/json',\n    'Authorization': `Bearer ${heraldKey}`\n  },\n  body: JSON.stringify({ to, from, subject, html })\n});\nif (!res.ok) { const b = await res.text().catch(() => ''); throw new Error(`Herald failed: ${res.status} ${b}`); }\nconst json = await res.json();\nreturn { messageId: json.id };",
          },
          next: "end",
        },
        {
          id: "end",
          type: "stop",
          name: "Workflow Complete",
          position: { x: 0, y: 500 },
          stop: {
            status: "success",
            reason: "Email sent successfully",
          },
        },
        {
          id: "end-suppressed",
          type: "stop",
          name: "Email Suppressed",
          position: { x: 200, y: 300 },
          stop: {
            status: "success",
            reason: "Email suppressed",
          },
        },
      ],
    },
    routes: [
      {
        typePattern: "gatekeeper.email.*",
        sourcePattern: "omni.gatekeeper",
        priority: 10,
        celCondition: null,
      },
    ],
  },
  {
    name: "gatekeeper-user-to-mantle",
    description: "Link newly created Gatekeeper users to Mantle person records",
    definition: {
      version: "1.0",
      executor: "temporal",
      settings: {
        timeout: "5m",
        retryPolicy: {
          maxAttempts: 3,
          backoffCoefficient: 2,
          initialInterval: "1s",
          maxInterval: "30s",
        },
      },
      edges: [],
      steps: [
        {
          id: "trigger",
          type: "trigger",
          name: "User Created",
          position: { x: 0, y: 0 },
          trigger: {
            type: "event",
            config: {
              pattern: "gatekeeper.user.created",
              source: "omni.gatekeeper",
            },
          },
          next: "query-mantle",
        },
        {
          id: "query-mantle",
          type: "code",
          name: "Query Mantle for Person",
          position: { x: 0, y: 100 },
          code: {
            sandbox: "worker",
            inputs: {
              email: "{{ steps['trigger'].output.event.data.email }}",
              organizationId:
                "{{ steps['trigger'].output.event.data.organizationId }}",
              mantleApiUrl: "{{ env.MANTLE_API_URL }}",
              mantleServiceKey: "{{ env.MANTLE_SERVICE_KEY }}",
            },
            source:
              "const { email, organizationId, mantleApiUrl, mantleServiceKey } = input;\nconst res = await fetch(mantleApiUrl, {\n  method: 'POST',\n  headers: {\n    'Content-Type': 'application/json',\n    'x-service-key': mantleServiceKey\n  },\n  body: JSON.stringify({\n    query: `query FindPerson($orgId: String!, $email: String!) {\n      people(condition: { organizationId: $orgId }, filter: { emails: { contains: [$email] } }) {\n        nodes {\n          rowId\n          firstName\n        }\n      }\n    }`,\n    variables: { orgId: organizationId, email }\n  })\n});\nconst json = await res.json();\nconst nodes = json.data?.people?.nodes ?? [];\nreturn { person: nodes[0] ?? null, email, organizationId };",
          },
          next: "check-exists",
        },
        {
          id: "check-exists",
          type: "condition",
          name: "Person Exists?",
          position: { x: 0, y: 200 },
          condition: {
            expression: "{{ steps['query-mantle'].output.person !== null }}",
            trueBranch: "link-person",
            falseBranch: "create-person",
          },
        },
        {
          id: "link-person",
          type: "code",
          name: "Link Existing Person",
          position: { x: -200, y: 300 },
          code: {
            sandbox: "worker",
            inputs: {
              personRowId: "{{ steps.query-mantle.output.person.rowId }}",
              userId: "{{ steps['trigger'].output.event.data.userId }}",
              mantleApiUrl: "{{ env.MANTLE_API_URL }}",
              mantleServiceKey: "{{ env.MANTLE_SERVICE_KEY }}",
            },
            source:
              "const { personRowId, userId, mantleApiUrl, mantleServiceKey } = input;\nconst res = await fetch(mantleApiUrl, {\n  method: 'POST',\n  headers: {\n    'Content-Type': 'application/json',\n    'x-service-key': mantleServiceKey\n  },\n  body: JSON.stringify({\n    query: `mutation CreatePersonExternalLink($input: CreatePersonExternalLinkInput!) {\n      createPersonExternalLink(input: $input) {\n        personExternalLink {\n          rowId\n          provider\n          externalId\n        }\n      }\n    }`,\n    variables: {\n      input: {\n        personExternalLink: {\n          personId: personRowId,\n          provider: 'gatekeeper',\n          externalId: userId\n        }\n      }\n    }\n  })\n});\nconst json = await res.json();\nreturn { linked: json.data?.createPersonExternalLink?.personExternalLink ?? null };",
          },
          next: "end",
        },
        {
          id: "create-person",
          type: "code",
          name: "Create Person and Link",
          position: { x: 200, y: 300 },
          code: {
            sandbox: "worker",
            inputs: {
              email: "{{ steps.query-mantle.output.email }}",
              organizationId: "{{ steps.query-mantle.output.organizationId }}",
              userId: "{{ steps['trigger'].output.event.data.userId }}",
              mantleApiUrl: "{{ env.MANTLE_API_URL }}",
              mantleServiceKey: "{{ env.MANTLE_SERVICE_KEY }}",
            },
            source:
              "const { email, organizationId, userId, mantleApiUrl, mantleServiceKey } = input;\nconst firstName = email.split('@')[0];\nconst headers = {\n  'Content-Type': 'application/json',\n  'x-service-key': mantleServiceKey\n};\nconst createRes = await fetch(mantleApiUrl, {\n  method: 'POST',\n  headers,\n  body: JSON.stringify({\n    query: `mutation CreatePerson($inp: CreatePersonInput!) {\n      createPerson(input: $inp) {\n        person {\n          rowId\n        }\n      }\n    }`,\n    variables: {\n      inp: {\n        person: {\n          firstName,\n          lastName: '',\n          emails: [email],\n          organizationId\n        }\n      }\n    }\n  })\n});\nconst createJson = await createRes.json();\nconst personId = createJson.data?.createPerson?.person?.rowId;\nif (!personId) throw new Error('Failed to create person');\nconst linkRes = await fetch(mantleApiUrl, {\n  method: 'POST',\n  headers,\n  body: JSON.stringify({\n    query: `mutation CreatePersonExternalLink($inp: CreatePersonExternalLinkInput!) {\n      createPersonExternalLink(input: $inp) {\n        personExternalLink {\n          rowId\n          provider\n          externalId\n        }\n      }\n    }`,\n    variables: {\n      inp: {\n        personExternalLink: {\n          personId,\n          provider: 'gatekeeper',\n          externalId: userId\n        }\n      }\n    }\n  })\n});\nconst linkJson = await linkRes.json();\nreturn { person: { rowId: personId }, linked: linkJson.data?.createPersonExternalLink?.personExternalLink ?? null };",
          },
          next: "end",
        },
        {
          id: "end",
          type: "stop",
          name: "Workflow Complete",
          position: { x: 0, y: 400 },
          stop: {
            status: "success",
            reason: "Gatekeeper user linked to Mantle person",
          },
        },
      ],
    },
    routes: [
      {
        typePattern: "gatekeeper.user.created",
        sourcePattern: "omni.gatekeeper",
        priority: 10,
        celCondition: null,
      },
    ],
  },
  {
    name: "fractal-email-send",
    description:
      "Send email notifications for Fractal service lifecycle events (build failed, service crashed, resource warnings)",
    definition: {
      version: "1.0",
      executor: "temporal",
      settings: {
        timeout: "2m",
        retryPolicy: {
          maxAttempts: 3,
          backoffCoefficient: 2,
          initialInterval: "1s",
          maxInterval: "30s",
        },
      },
      edges: [],
      steps: [
        {
          id: "trigger",
          type: "trigger",
          name: "Fractal Event",
          position: { x: 0, y: 0 },
          trigger: {
            type: "event",
            config: {
              pattern: "fractal.*",
              source: "omni.fractal",
            },
          },
          next: "resolve-members",
        },
        {
          id: "resolve-members",
          type: "code",
          name: "Resolve Workspace Members",
          position: { x: 0, y: 100 },
          code: {
            // Trusted platform-org system workflow: run in-process to avoid the
            // Bun Worker churn that segfaults the worker under load. Gated to
            // the platform org by the worker; non-platform orgs get "worker".
            sandbox: "native",
            inputs: {
              owner: "{{ steps['trigger'].output.event.data.owner }}",
              gatekeeperApiUrl: "{{ env.AUTH_API_URL }}",
              orgSyncServiceToken: "{{ env.ORG_SYNC_SERVICE_TOKEN }}",
            },
            source:
              "const { owner, gatekeeperApiUrl, orgSyncServiceToken } = input;\nconst orgRes = await fetch(`${gatekeeperApiUrl}/api/organization/by-slug/${owner}`, {\n  headers: { 'Content-Type': 'application/json' }\n});\nif (!orgRes.ok) {\n  console.error(`[fractal-email] org lookup failed for ${owner}: ${orgRes.status}`);\n  return { recipients: [] };\n}\nconst org = await orgRes.json();\nconst membersRes = await fetch(`${gatekeeperApiUrl}/api/organization/members?orgId=${org.id}`, {\n  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${orgSyncServiceToken}` }\n});\nif (!membersRes.ok) {\n  console.error(`[fractal-email] members lookup failed for org ${org.id}: ${membersRes.status}`);\n  return { recipients: [] };\n}\nconst { data: members } = await membersRes.json();\nconsole.log(`[fractal-email] resolved ${members.length} recipients for ${owner}`);\nreturn { recipients: members.map(m => m.user.email) };",
          },
          next: "send-emails",
        },
        {
          id: "send-emails",
          type: "code",
          name: "Send Notification Emails",
          position: { x: 0, y: 200 },
          code: {
            // Trusted platform-org system workflow: in-process (see above).
            sandbox: "native",
            inputs: {
              recipients: "{{ steps['resolve-members'].output.recipients }}",
              eventType: "{{ steps['trigger'].output.event.type }}",
              service: "{{ steps['trigger'].output.event.data.service }}",
              project: "{{ steps['trigger'].output.event.data.project }}",
              owner: "{{ steps['trigger'].output.event.data.owner }}",
              phase: "{{ steps['trigger'].output.event.data.phase }}",
              image: "{{ steps['trigger'].output.event.data.image }}",
              commit: "{{ steps['trigger'].output.event.data.commit }}",
              memory_limit:
                "{{ steps['trigger'].output.event.data.memory_limit }}",
              memory_usage:
                "{{ steps['trigger'].output.event.data.memory_usage }}",
              fractalAppUrl: "{{ env.FRACTAL_APP_URL }}",
              emailRenderSecret: "{{ env.EMAIL_RENDER_SECRET }}",
              heraldUrl: "{{ env.HERALD_API_URL }}",
              heraldKey: "{{ env.HERALD_API_KEY }}",
              heraldSender: "{{ env.HERALD_SENDER_EMAIL_ADDRESS }}",
              senderAddress: "{{ env.SENDER_EMAIL_ADDRESS }}",
              vortexApiUrl: "{{ env.VORTEX_API_URL }}",
              vortexApiKey: "{{ env.VORTEX_API_KEY }}",
            },
            source:
              "const { recipients, eventType, service, project, owner, phase, image, commit, memory_limit, memory_usage, fractalAppUrl, emailRenderSecret, heraldUrl, heraldKey, heraldSender, senderAddress, vortexApiUrl, vortexApiKey } = input;\nif (!recipients || recipients.length === 0) return { sent: 0 };\nif (!heraldUrl || !heraldKey) {\n  console.error('[fractal-email] Herald not configured');\n  return { sent: 0, reason: 'no-email-provider' };\n}\n\nlet templateId;\nif (eventType.includes('build.failed')) templateId = 'build-failed';\nelse if (eventType.includes('deploy.succeeded')) templateId = 'deploy-succeeded';\nelse if (eventType.includes('service.crashed')) templateId = 'service-crashed';\nelse if (eventType.includes('service.resource_warning')) templateId = 'resource-warning';\nelse return { sent: 0, reason: 'unknown event type' };\n\nconst fractalUrl = `${fractalAppUrl}/workspaces/${owner}/projects/${project}/services/${service}`;\nconst templateData = { serviceName: service, projectName: project, commitSha: commit, fractalUrl, imageTag: image?.split(':').pop() };\nif (memory_limit) templateData.memoryLimit = memory_limit;\nif (memory_usage) templateData.memoryUsage = memory_usage;\n\nconst from = heraldSender || senderAddress || 'notifications@send.omni.dev';\nlet sent = 0;\nfor (const email of recipients) {\n  const suppRes = await fetch(vortexApiUrl, {\n    method: 'POST',\n    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${vortexApiKey}` },\n    body: JSON.stringify({ query: `query($email:String!){emailSuppressions(condition:{email:$email}){totalCount}}`, variables: { email } })\n  });\n  const suppJson = await suppRes.json().catch(() => ({}));\n  if ((suppJson.data?.emailSuppressions?.totalCount ?? 0) > 0) continue;\n\n  const renderRes = await fetch(`${fractalAppUrl}/api/email/render`, {\n    method: 'POST',\n    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${emailRenderSecret}` },\n    body: JSON.stringify({ templateId, templateData })\n  });\n  if (!renderRes.ok) {\n    const body = await renderRes.text().catch(() => '');\n    console.error(`[fractal-email] render failed for ${email}: ${renderRes.status} ${body}`);\n    continue;\n  }\n  const { html, subject } = await renderRes.json();\n\n  const sendRes = await fetch(`${heraldUrl}/messages`, {\n    method: 'POST',\n    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${heraldKey}` },\n    body: JSON.stringify({ to: email, from, subject: `${subject} - ${service}`, html, idempotencyKey: `${eventType}:${service}:${commit || phase || 'na'}:${email}` })\n  });\n  if (!sendRes.ok) {\n    const body = await sendRes.text().catch(() => '');\n    console.error(`[fractal-email] herald failed for ${email}: ${sendRes.status} ${body}`);\n    continue;\n  }\n  sent++;\n}\nreturn { sent };",
          },
          next: "end",
        },
        {
          id: "end",
          type: "stop",
          name: "Workflow Complete",
          position: { x: 0, y: 300 },
          stop: {
            status: "success",
            reason: "Fractal notification emails processed",
          },
        },
      ],
    },
    routes: [
      {
        typePattern: "fractal.*",
        sourcePattern: "omni.fractal",
        priority: 10,
        // Only route fractal events that carry an owner (deploy.succeeded,
        // service.crashed, build.failed). The high-frequency owner-less events
        // (service.reconciled, rebuild_triggered, backup.*) can never resolve a
        // recipient, so filtering them here avoids spawning a workflow run per
        // operator reconcile (a firehose that crashed the worker).
        celCondition: 'has(event.data.owner) && event.data.owner != ""',
      },
    ],
  },
  {
    name: "halo-order-confirmed",
    description:
      "Send buyer receipt and seller notification emails when a Halo order is confirmed",
    // Imported JSON definition (canonical, verified in prod). Cast to match the
    // inline literal entries above; the seed only reads `.edges`, `.steps`, and
    // `.executor` off it.
    // biome-ignore lint/suspicious/noExplicitAny: imported JSON definition shape differs from inline literals
    definition: haloOrderConfirmed as any,
    routes: [
      {
        typePattern: "halo.order.confirmed",
        sourcePattern: "omni.halo",
        priority: 10,
        celCondition: null,
      },
    ],
  },
];

/**
 * Seed system event-triggered workflows and their routing rules for the platform organization.
 * Idempotent: finds by name + organizationId, inserts if missing, updates if present.
 */
async function seedEventWorkflows(
  // biome-ignore lint/suspicious/noExplicitAny: drizzle db instance type varies by driver
  db: any,
  organizationId: string,
) {
  let seeded = 0;

  for (const wf of eventWorkflows) {
    const { routes, ...workflowData } = wf;

    // Auto-generate edges from step `next` fields if edges array is empty
    if (
      workflowData.definition.edges.length === 0 &&
      workflowData.definition.steps.length > 0
    ) {
      const edges: { source: string; target: string }[] = [];
      for (const step of workflowData.definition.steps) {
        const next = (step as Record<string, unknown>).next as
          | string
          | string[]
          | undefined;
        if (typeof next === "string") {
          edges.push({ source: step.id, target: next });
        } else if (Array.isArray(next)) {
          for (const target of next) {
            edges.push({ source: step.id, target });
          }
        }
        // Condition steps: trueBranch / falseBranch
        const condition = (step as Record<string, unknown>).condition as
          | { trueBranch?: string; falseBranch?: string }
          | undefined;
        if (condition?.trueBranch) {
          edges.push({
            source: step.id,
            target: condition.trueBranch,
            ...({ sourceHandle: "true" } as Record<string, string>),
          });
        }
        if (condition?.falseBranch) {
          edges.push({
            source: step.id,
            target: condition.falseBranch,
            ...({ sourceHandle: "false" } as Record<string, string>),
          });
        }
      }
      (workflowData.definition as { edges: typeof edges }).edges = edges;
    }

    const existing = await db.query.workflowTable.findFirst({
      where: and(
        eq(workflowTable.name, workflowData.name),
        eq(workflowTable.organizationId, organizationId),
      ),
      columns: { id: true },
    });

    let workflowId: string;

    if (existing) {
      await db
        .update(workflowTable)
        .set({
          definition: workflowData.definition,
          description: workflowData.description,
          isActive: true,
          executor:
            (workflowData.definition as { executor?: string }).executor ??
            "temporal",
        })
        .where(eq(workflowTable.id, existing.id));

      workflowId = existing.id;
    } else {
      const [inserted] = await db
        .insert(workflowTable)
        .values({
          ...workflowData,
          organizationId,
          isActive: true,
          executor:
            (workflowData.definition as { executor?: string }).executor ??
            "temporal",
        })
        .returning({ id: workflowTable.id });

      workflowId = inserted.id;
    }

    // Upsert routing rules
    for (const route of routes) {
      const existingRule = await db.query.eventRoutingRuleTable.findFirst({
        where: and(
          eq(eventRoutingRuleTable.workflowId, workflowId),
          eq(eventRoutingRuleTable.typePattern, route.typePattern),
          eq(eventRoutingRuleTable.organizationId, organizationId),
        ),
        columns: { id: true },
      });

      if (existingRule) {
        await db
          .update(eventRoutingRuleTable)
          .set({
            sourcePattern: route.sourcePattern,
            priority: route.priority,
            celCondition: route.celCondition,
            enabled: true,
          })
          .where(eq(eventRoutingRuleTable.id, existingRule.id));
      } else {
        await db.insert(eventRoutingRuleTable).values({
          workflowId,
          organizationId,
          typePattern: route.typePattern,
          sourcePattern: route.sourcePattern,
          priority: route.priority,
          celCondition: route.celCondition,
          enabled: true,
        });
      }
    }

    seeded++;
  }

  // biome-ignore lint/suspicious/noConsole: Seed script logging
  console.log(`Seeded ${seeded} event workflows`);
}

export default seedEventWorkflows;
