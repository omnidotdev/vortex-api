// @ts-nocheck
import { PgCondition, PgDeleteSingleStep, PgExecutor, TYPES, assertPgClassSingleStep, listOfCodec, makeRegistry, pgDeleteSingle, pgInsertSingle, pgSelectFromRecord, pgUpdateSingle, recordCodec, sqlValueWithCodec } from "@dataplan/pg";
import { ConnectionStep, EdgeStep, ObjectStep, __ValueStep, access, assertEdgeCapableStep, assertExecutableStep, assertPageInfoCapableStep, bakedInputRuntime, connection, constant, context, createObjectAndApplyChildren, first, inhibitOnNull, lambda, list, makeGrafastSchema, node, object, rootValue, specFromNodeId } from "grafast";
import { GraphQLError, Kind } from "graphql";
import { sql } from "pg-sql2";
const handler = {
  typeName: "Query",
  codec: {
    name: "raw",
    encode: Object.assign(function rawEncode(value) {
      return typeof value === "string" ? value : null;
    }, {
      isSyncAndSafe: true
    }),
    decode: Object.assign(function rawDecode(value) {
      return typeof value === "string" ? value : null;
    }, {
      isSyncAndSafe: true
    })
  },
  match(specifier) {
    return specifier === "query";
  },
  getIdentifiers(_value) {
    return [];
  },
  getSpec() {
    return "irrelevant";
  },
  get() {
    return rootValue();
  },
  plan() {
    return constant`query`;
  }
};
const nodeIdCodecs_base64JSON_base64JSON = {
  name: "base64JSON",
  encode: (() => {
    function base64JSONEncode(value) {
      return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
    }
    base64JSONEncode.isSyncAndSafe = !0;
    return base64JSONEncode;
  })(),
  decode: (() => {
    function base64JSONDecode(value) {
      return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
    }
    base64JSONDecode.isSyncAndSafe = !0;
    return base64JSONDecode;
  })()
};
const nodeIdCodecs = {
  __proto__: null,
  raw: handler.codec,
  base64JSON: nodeIdCodecs_base64JSON_base64JSON,
  pipeString: {
    name: "pipeString",
    encode: Object.assign(function pipeStringEncode(value) {
      return Array.isArray(value) ? value.join("|") : null;
    }, {
      isSyncAndSafe: true
    }),
    decode: Object.assign(function pipeStringDecode(value) {
      return typeof value === "string" ? value.split("|") : null;
    }, {
      isSyncAndSafe: true
    })
  }
};
const executor = new PgExecutor({
  name: "main",
  context() {
    const ctx = context();
    return object({
      pgSettings: "pgSettings" != null ? ctx.get("pgSettings") : constant(null),
      withPgClient: ctx.get("withPgClient")
    });
  }
});
const integrationIdentifier = sql.identifier("public", "integration");
const spec_integration = {
  name: "integration",
  identifier: integrationIdentifier,
  attributes: {
    __proto__: null,
    id: {
      description: undefined,
      codec: TYPES.uuid,
      notNull: true,
      hasDefault: true,
      extensions: {
        tags: {},
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    type: {
      description: undefined,
      codec: TYPES.text,
      notNull: true,
      hasDefault: false,
      extensions: {
        tags: {},
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    name: {
      description: undefined,
      codec: TYPES.text,
      notNull: true,
      hasDefault: false,
      extensions: {
        tags: {},
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    is_enabled: {
      description: undefined,
      codec: TYPES.boolean,
      notNull: true,
      hasDefault: true,
      extensions: {
        tags: {},
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    config: {
      description: undefined,
      codec: TYPES.jsonb,
      notNull: true,
      hasDefault: true,
      extensions: {
        tags: {},
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    user_id: {
      description: undefined,
      codec: TYPES.uuid,
      notNull: true,
      hasDefault: false,
      extensions: {
        tags: {},
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    created_at: {
      description: undefined,
      codec: TYPES.timestamptz,
      notNull: false,
      hasDefault: true,
      extensions: {
        tags: {},
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    updated_at: {
      description: undefined,
      codec: TYPES.timestamptz,
      notNull: false,
      hasDefault: true,
      extensions: {
        tags: {},
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    }
  },
  description: undefined,
  extensions: {
    oid: "33806",
    isTableLike: true,
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "integration"
    },
    tags: {
      __proto__: null
    }
  },
  executor: executor
};
const integrationCodec = recordCodec(spec_integration);
const userIdentifier = sql.identifier("public", "user");
const spec_user = {
  name: "user",
  identifier: userIdentifier,
  attributes: {
    __proto__: null,
    id: {
      description: undefined,
      codec: TYPES.uuid,
      notNull: true,
      hasDefault: true,
      extensions: {
        tags: {},
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    identity_provider_id: {
      description: undefined,
      codec: TYPES.uuid,
      notNull: true,
      hasDefault: false,
      extensions: {
        tags: {},
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    created_at: {
      description: undefined,
      codec: TYPES.timestamptz,
      notNull: false,
      hasDefault: true,
      extensions: {
        tags: {},
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    updated_at: {
      description: undefined,
      codec: TYPES.timestamptz,
      notNull: false,
      hasDefault: true,
      extensions: {
        tags: {},
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    email: {
      description: undefined,
      codec: TYPES.text,
      notNull: true,
      hasDefault: false,
      extensions: {
        tags: {},
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    name: {
      description: undefined,
      codec: TYPES.text,
      notNull: true,
      hasDefault: false,
      extensions: {
        tags: {},
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    avatar: {
      description: undefined,
      codec: TYPES.text,
      notNull: false,
      hasDefault: false,
      extensions: {
        tags: {},
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    is_onboarded: {
      description: undefined,
      codec: TYPES.boolean,
      notNull: true,
      hasDefault: true,
      extensions: {
        tags: {},
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    theme: {
      description: undefined,
      codec: TYPES.text,
      notNull: false,
      hasDefault: true,
      extensions: {
        tags: {},
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    plan_type: {
      description: undefined,
      codec: TYPES.text,
      notNull: true,
      hasDefault: true,
      extensions: {
        tags: {},
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    }
  },
  description: undefined,
  extensions: {
    oid: "33776",
    isTableLike: true,
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "user"
    },
    tags: {
      __proto__: null
    }
  },
  executor: executor
};
const userCodec = recordCodec(spec_user);
const workflowIdentifier = sql.identifier("public", "workflow");
const spec_workflow = {
  name: "workflow",
  identifier: workflowIdentifier,
  attributes: {
    __proto__: null,
    id: {
      description: undefined,
      codec: TYPES.uuid,
      notNull: true,
      hasDefault: true,
      extensions: {
        tags: {},
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    name: {
      description: undefined,
      codec: TYPES.text,
      notNull: true,
      hasDefault: false,
      extensions: {
        tags: {},
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    description: {
      description: undefined,
      codec: TYPES.text,
      notNull: false,
      hasDefault: false,
      extensions: {
        tags: {},
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    definition: {
      description: undefined,
      codec: TYPES.jsonb,
      notNull: true,
      hasDefault: false,
      extensions: {
        tags: {},
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    is_active: {
      description: undefined,
      codec: TYPES.boolean,
      notNull: true,
      hasDefault: true,
      extensions: {
        tags: {},
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    user_id: {
      description: undefined,
      codec: TYPES.uuid,
      notNull: true,
      hasDefault: false,
      extensions: {
        tags: {},
        canSelect: true,
        canInsert: true,
        canUpdate: true
      }
    },
    created_at: {
      description: undefined,
      codec: TYPES.timestamptz,
      notNull: false,
      hasDefault: true,
      extensions: {
        tags: {},
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    },
    updated_at: {
      description: undefined,
      codec: TYPES.timestamptz,
      notNull: false,
      hasDefault: true,
      extensions: {
        tags: {},
        canSelect: true,
        canInsert: true,
        canUpdate: true,
        isIndexed: false
      }
    }
  },
  description: undefined,
  extensions: {
    oid: "33795",
    isTableLike: true,
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "workflow"
    },
    tags: {
      __proto__: null
    }
  },
  executor: executor
};
const workflowCodec = recordCodec(spec_workflow);
const userUniques = [{
  isPrimary: true,
  attributes: ["id"],
  description: undefined,
  extensions: {
    tags: {
      __proto__: null
    }
  }
}, {
  isPrimary: false,
  attributes: ["email"],
  description: undefined,
  extensions: {
    tags: {
      __proto__: null
    }
  }
}, {
  isPrimary: false,
  attributes: ["identity_provider_id"],
  description: undefined,
  extensions: {
    tags: {
      __proto__: null
    }
  }
}];
const registryConfig_pgResources_user_user = {
  executor: executor,
  name: "user",
  identifier: "main.public.user",
  from: userIdentifier,
  codec: userCodec,
  uniques: userUniques,
  isVirtual: false,
  description: undefined,
  extensions: {
    description: undefined,
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "user"
    },
    isInsertable: true,
    isUpdatable: true,
    isDeletable: true,
    tags: {},
    canSelect: true,
    canInsert: true,
    canUpdate: true,
    canDelete: true
  }
};
const integrationUniques = [{
  isPrimary: true,
  attributes: ["id"],
  description: undefined,
  extensions: {
    tags: {
      __proto__: null
    }
  }
}];
const registryConfig_pgResources_integration_integration = {
  executor: executor,
  name: "integration",
  identifier: "main.public.integration",
  from: integrationIdentifier,
  codec: integrationCodec,
  uniques: integrationUniques,
  isVirtual: false,
  description: undefined,
  extensions: {
    description: undefined,
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "integration"
    },
    isInsertable: true,
    isUpdatable: true,
    isDeletable: true,
    tags: {},
    canSelect: true,
    canInsert: true,
    canUpdate: true,
    canDelete: true
  }
};
const workflowUniques = [{
  isPrimary: true,
  attributes: ["id"],
  description: undefined,
  extensions: {
    tags: {
      __proto__: null
    }
  }
}];
const registryConfig_pgResources_workflow_workflow = {
  executor: executor,
  name: "workflow",
  identifier: "main.public.workflow",
  from: workflowIdentifier,
  codec: workflowCodec,
  uniques: workflowUniques,
  isVirtual: false,
  description: undefined,
  extensions: {
    description: undefined,
    pg: {
      serviceName: "main",
      schemaName: "public",
      name: "workflow"
    },
    isInsertable: true,
    isUpdatable: true,
    isDeletable: true,
    tags: {},
    canSelect: true,
    canInsert: true,
    canUpdate: true,
    canDelete: true
  }
};
const registryConfig = {
  pgExecutors: {
    __proto__: null,
    main: executor
  },
  pgCodecs: {
    __proto__: null,
    uuid: TYPES.uuid,
    integration: integrationCodec,
    text: TYPES.text,
    bool: TYPES.boolean,
    jsonb: TYPES.jsonb,
    timestamptz: TYPES.timestamptz,
    user: userCodec,
    workflow: workflowCodec
  },
  pgResources: {
    __proto__: null,
    user: registryConfig_pgResources_user_user,
    integration: registryConfig_pgResources_integration_integration,
    workflow: registryConfig_pgResources_workflow_workflow
  },
  pgRelations: {
    __proto__: null,
    integration: {
      __proto__: null,
      userByMyUserId: {
        localCodec: integrationCodec,
        remoteResourceOptions: registryConfig_pgResources_user_user,
        localCodecPolymorphicTypes: undefined,
        localAttributes: ["user_id"],
        remoteAttributes: ["id"],
        isUnique: true,
        isReferencee: false,
        description: undefined,
        extensions: {
          tags: {
            behavior: []
          }
        }
      }
    },
    user: {
      __proto__: null,
      workflowsByTheirUserId: {
        localCodec: userCodec,
        remoteResourceOptions: registryConfig_pgResources_workflow_workflow,
        localCodecPolymorphicTypes: undefined,
        localAttributes: ["id"],
        remoteAttributes: ["user_id"],
        isUnique: false,
        isReferencee: true,
        description: undefined,
        extensions: {
          tags: {
            behavior: []
          }
        }
      },
      integrationsByTheirUserId: {
        localCodec: userCodec,
        remoteResourceOptions: registryConfig_pgResources_integration_integration,
        localCodecPolymorphicTypes: undefined,
        localAttributes: ["id"],
        remoteAttributes: ["user_id"],
        isUnique: false,
        isReferencee: true,
        description: undefined,
        extensions: {
          tags: {
            behavior: []
          }
        }
      }
    },
    workflow: {
      __proto__: null,
      userByMyUserId: {
        localCodec: workflowCodec,
        remoteResourceOptions: registryConfig_pgResources_user_user,
        localCodecPolymorphicTypes: undefined,
        localAttributes: ["user_id"],
        remoteAttributes: ["id"],
        isUnique: true,
        isReferencee: false,
        description: undefined,
        extensions: {
          tags: {
            behavior: []
          }
        }
      }
    }
  }
};
const registry = makeRegistry(registryConfig);
const pgResource_userPgResource = registry.pgResources["user"];
const pgResource_integrationPgResource = registry.pgResources["integration"];
const pgResource_workflowPgResource = registry.pgResources["workflow"];
const nodeIdHandlerByTypeName = {
  __proto__: null,
  Query: handler,
  User: {
    typeName: "User",
    codec: nodeIdCodecs_base64JSON_base64JSON,
    deprecationReason: undefined,
    plan($record) {
      return list([constant("User", false), $record.get("id")]);
    },
    getSpec($list) {
      return {
        id: inhibitOnNull(access($list, [1]))
      };
    },
    getIdentifiers(value) {
      return value.slice(1);
    },
    get(spec) {
      return pgResource_userPgResource.get(spec);
    },
    match(obj) {
      return obj[0] === "User";
    }
  },
  Integration: {
    typeName: "Integration",
    codec: nodeIdCodecs_base64JSON_base64JSON,
    deprecationReason: undefined,
    plan($record) {
      return list([constant("Integration", false), $record.get("id")]);
    },
    getSpec($list) {
      return {
        id: inhibitOnNull(access($list, [1]))
      };
    },
    getIdentifiers(value) {
      return value.slice(1);
    },
    get(spec) {
      return pgResource_integrationPgResource.get(spec);
    },
    match(obj) {
      return obj[0] === "Integration";
    }
  },
  Workflow: {
    typeName: "Workflow",
    codec: nodeIdCodecs_base64JSON_base64JSON,
    deprecationReason: undefined,
    plan($record) {
      return list([constant("Workflow", false), $record.get("id")]);
    },
    getSpec($list) {
      return {
        id: inhibitOnNull(access($list, [1]))
      };
    },
    getIdentifiers(value) {
      return value.slice(1);
    },
    get(spec) {
      return pgResource_workflowPgResource.get(spec);
    },
    match(obj) {
      return obj[0] === "Workflow";
    }
  }
};
function specForHandler(handler) {
  function spec(nodeId) {
    if (nodeId == null) return null;
    try {
      const specifier = handler.codec.decode(nodeId);
      if (handler.match(specifier)) return specifier;
    } catch {}
    return null;
  }
  spec.displayName = `specifier_${handler.typeName}_${handler.codec.name}`;
  spec.isSyncAndSafe = !0;
  return spec;
}
const nodeFetcher_User = $nodeId => {
  const $decoded = lambda($nodeId, specForHandler(nodeIdHandlerByTypeName.User));
  return nodeIdHandlerByTypeName.User.get(nodeIdHandlerByTypeName.User.getSpec($decoded));
};
const nodeFetcher_Integration = $nodeId => {
  const $decoded = lambda($nodeId, specForHandler(nodeIdHandlerByTypeName.Integration));
  return nodeIdHandlerByTypeName.Integration.get(nodeIdHandlerByTypeName.Integration.getSpec($decoded));
};
const nodeFetcher_Workflow = $nodeId => {
  const $decoded = lambda($nodeId, specForHandler(nodeIdHandlerByTypeName.Workflow));
  return nodeIdHandlerByTypeName.Workflow.get(nodeIdHandlerByTypeName.Workflow.getSpec($decoded));
};
function qbWhereBuilder(qb) {
  return qb.whereBuilder();
}
function isEmpty(o) {
  return typeof o === "object" && o !== null && Object.keys(o).length === 0;
}
function assertAllowed(value, mode) {
  if (mode === "object" && !false && isEmpty(value)) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
  if (mode === "list" && !false) {
    const arr = value;
    if (arr) {
      const l = arr.length;
      for (let i = 0; i < l; i++) if (isEmpty(arr[i])) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
    }
  }
  if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
}
function assertAllowed2(value, mode) {
  if (mode === "object" && !false && isEmpty(value)) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
  if (mode === "list" && !false) {
    const arr = value;
    if (arr) {
      const l = arr.length;
      for (let i = 0; i < l; i++) if (isEmpty(arr[i])) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
    }
  }
  if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
}
function assertAllowed3(value, mode) {
  if (mode === "object" && !false && isEmpty(value)) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
  if (mode === "list" && !false) {
    const arr = value;
    if (arr) {
      const l = arr.length;
      for (let i = 0; i < l; i++) if (isEmpty(arr[i])) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
    }
  }
  if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
}
function assertAllowed4(value, mode) {
  if (mode === "object" && !false && isEmpty(value)) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
  if (mode === "list" && !false) {
    const arr = value;
    if (arr) {
      const l = arr.length;
      for (let i = 0; i < l; i++) if (isEmpty(arr[i])) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
    }
  }
  if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
}
function assertAllowed5(value, mode) {
  if (mode === "object" && !false && isEmpty(value)) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
  if (mode === "list" && !false) {
    const arr = value;
    if (arr) {
      const l = arr.length;
      for (let i = 0; i < l; i++) if (isEmpty(arr[i])) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
    }
  }
  if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
}
function UUIDSerialize(value) {
  return "" + value;
}
const coerce = string => {
  if (!/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(string)) throw new GraphQLError("Invalid UUID, expected 32 hexadecimal characters, optionally with hypens");
  return string;
};
const colSpec = {
  fieldName: "rowId",
  attributeName: "id",
  attribute: spec_workflow.attributes.id
};
const colSpec2 = {
  fieldName: "isActive",
  attributeName: "is_active",
  attribute: spec_workflow.attributes.is_active
};
const colSpec3 = {
  fieldName: "userId",
  attributeName: "user_id",
  attribute: spec_workflow.attributes.user_id
};
function assertAllowed6(value, mode) {
  if (mode === "object" && !false && isEmpty(value)) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
  if (mode === "list" && !false) {
    const arr = value;
    if (arr) {
      const l = arr.length;
      for (let i = 0; i < l; i++) if (isEmpty(arr[i])) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
    }
  }
  if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
}
function assertAllowed7(value, mode) {
  if (mode === "object" && !false && isEmpty(value)) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
  if (mode === "list" && !false) {
    const arr = value;
    if (arr) {
      const l = arr.length;
      for (let i = 0; i < l; i++) if (isEmpty(arr[i])) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
    }
  }
  if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
}
const resolve = (i, _v, input) => sql`${i} ${input ? sql`IS NULL` : sql`IS NOT NULL`}`;
const resolveInputCodec = () => TYPES.boolean;
const resolveSqlValue = () => sql.null;
const resolve2 = (i, v) => sql`${i} = ${v}`;
const forceTextTypesSensitive = [TYPES.citext, TYPES.char, TYPES.bpchar];
function resolveDomains(c) {
  let current = c;
  while (current.domainOfCodec) current = current.domainOfCodec;
  return current;
}
function resolveInputCodec2(c) {
  if (c.arrayOfCodec) {
    if (forceTextTypesSensitive.includes(resolveDomains(c.arrayOfCodec))) return listOfCodec(TYPES.text, {
      extensions: {
        listItemNonNull: c.extensions?.listItemNonNull
      }
    });
    return c;
  } else {
    if (forceTextTypesSensitive.includes(resolveDomains(c))) return TYPES.text;
    return c;
  }
}
function resolveSqlIdentifier(identifier, c) {
  if (c.arrayOfCodec && forceTextTypesSensitive.includes(resolveDomains(c.arrayOfCodec))) return [sql`(${identifier})::text[]`, listOfCodec(TYPES.text, {
    extensions: {
      listItemNonNull: c.extensions?.listItemNonNull
    }
  })];else if (forceTextTypesSensitive.includes(resolveDomains(c))) return [sql`(${identifier})::text`, TYPES.text];else return [identifier, c];
}
const resolve3 = (i, v) => sql`${i} <> ${v}`;
const resolve4 = (i, v) => sql`${i} IS DISTINCT FROM ${v}`;
const resolve5 = (i, v) => sql`${i} IS NOT DISTINCT FROM ${v}`;
const resolve6 = (i, v) => sql`${i} = ANY(${v})`;
function resolveInputCodec3(c) {
  if (forceTextTypesSensitive.includes(resolveDomains(c))) return listOfCodec(TYPES.text, {
    extensions: {
      listItemNonNull: !0
    }
  });else return listOfCodec(c, {
    extensions: {
      listItemNonNull: !0
    }
  });
}
const resolve7 = (i, v) => sql`${i} <> ALL(${v})`;
const resolve8 = (i, v) => sql`${i} < ${v}`;
const resolve9 = (i, v) => sql`${i} <= ${v}`;
const resolve10 = (i, v) => sql`${i} > ${v}`;
const resolve11 = (i, v) => sql`${i} >= ${v}`;
const resolve12 = (i, _v, input) => sql`${i} ${input ? sql`IS NULL` : sql`IS NOT NULL`}`;
const resolveInputCodec4 = () => TYPES.boolean;
const resolveSqlValue2 = () => sql.null;
const resolve13 = (i, v) => sql`${i} = ${v}`;
const forceTextTypesSensitive2 = [TYPES.citext, TYPES.char, TYPES.bpchar];
function resolveDomains2(c) {
  let current = c;
  while (current.domainOfCodec) current = current.domainOfCodec;
  return current;
}
function resolveInputCodec5(c) {
  if (c.arrayOfCodec) {
    if (forceTextTypesSensitive2.includes(resolveDomains2(c.arrayOfCodec))) return listOfCodec(TYPES.text, {
      extensions: {
        listItemNonNull: c.extensions?.listItemNonNull
      }
    });
    return c;
  } else {
    if (forceTextTypesSensitive2.includes(resolveDomains2(c))) return TYPES.text;
    return c;
  }
}
function resolveSqlIdentifier2(identifier, c) {
  if (c.arrayOfCodec && forceTextTypesSensitive2.includes(resolveDomains2(c.arrayOfCodec))) return [sql`(${identifier})::text[]`, listOfCodec(TYPES.text, {
    extensions: {
      listItemNonNull: c.extensions?.listItemNonNull
    }
  })];else if (forceTextTypesSensitive2.includes(resolveDomains2(c))) return [sql`(${identifier})::text`, TYPES.text];else return [identifier, c];
}
const resolve14 = (i, v) => sql`${i} <> ${v}`;
const resolve15 = (i, v) => sql`${i} IS DISTINCT FROM ${v}`;
const resolve16 = (i, v) => sql`${i} IS NOT DISTINCT FROM ${v}`;
const resolve17 = (i, v) => sql`${i} = ANY(${v})`;
function resolveInputCodec6(c) {
  if (forceTextTypesSensitive2.includes(resolveDomains2(c))) return listOfCodec(TYPES.text, {
    extensions: {
      listItemNonNull: !0
    }
  });else return listOfCodec(c, {
    extensions: {
      listItemNonNull: !0
    }
  });
}
const resolve18 = (i, v) => sql`${i} <> ALL(${v})`;
const resolve19 = (i, v) => sql`${i} < ${v}`;
const resolve20 = (i, v) => sql`${i} <= ${v}`;
const resolve21 = (i, v) => sql`${i} > ${v}`;
const resolve22 = (i, v) => sql`${i} >= ${v}`;
const colSpec4 = {
  fieldName: "rowId",
  attributeName: "id",
  attribute: spec_user.attributes.id
};
const colSpec5 = {
  fieldName: "identityProviderId",
  attributeName: "identity_provider_id",
  attribute: spec_user.attributes.identity_provider_id
};
const colSpec6 = {
  fieldName: "email",
  attributeName: "email",
  attribute: spec_user.attributes.email
};
function assertAllowed8(value, mode) {
  if (mode === "object" && !false && isEmpty(value)) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
  if (mode === "list" && !false) {
    const arr = value;
    if (arr) {
      const l = arr.length;
      for (let i = 0; i < l; i++) if (isEmpty(arr[i])) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
    }
  }
  if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
}
function assertAllowed9(value, mode) {
  if (mode === "object" && !false && isEmpty(value)) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
  if (mode === "list" && !false) {
    const arr = value;
    if (arr) {
      const l = arr.length;
      for (let i = 0; i < l; i++) if (isEmpty(arr[i])) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
    }
  }
  if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
}
const resolve23 = (i, _v, input) => sql`${i} ${input ? sql`IS NULL` : sql`IS NOT NULL`}`;
const resolveInputCodec7 = () => TYPES.boolean;
const resolveSqlValue3 = () => sql.null;
const resolve24 = (i, v) => sql`${i} = ${v}`;
const forceTextTypesSensitive3 = [TYPES.citext, TYPES.char, TYPES.bpchar];
function resolveDomains3(c) {
  let current = c;
  while (current.domainOfCodec) current = current.domainOfCodec;
  return current;
}
function resolveInputCodec8(c) {
  if (c.arrayOfCodec) {
    if (forceTextTypesSensitive3.includes(resolveDomains3(c.arrayOfCodec))) return listOfCodec(TYPES.text, {
      extensions: {
        listItemNonNull: c.extensions?.listItemNonNull
      }
    });
    return c;
  } else {
    if (forceTextTypesSensitive3.includes(resolveDomains3(c))) return TYPES.text;
    return c;
  }
}
function resolveSqlIdentifier3(identifier, c) {
  if (c.arrayOfCodec && forceTextTypesSensitive3.includes(resolveDomains3(c.arrayOfCodec))) return [sql`(${identifier})::text[]`, listOfCodec(TYPES.text, {
    extensions: {
      listItemNonNull: c.extensions?.listItemNonNull
    }
  })];else if (forceTextTypesSensitive3.includes(resolveDomains3(c))) return [sql`(${identifier})::text`, TYPES.text];else return [identifier, c];
}
const resolve25 = (i, v) => sql`${i} <> ${v}`;
const resolve26 = (i, v) => sql`${i} IS DISTINCT FROM ${v}`;
const resolve27 = (i, v) => sql`${i} IS NOT DISTINCT FROM ${v}`;
const resolve28 = (i, v) => sql`${i} = ANY(${v})`;
function resolveInputCodec9(c) {
  if (forceTextTypesSensitive3.includes(resolveDomains3(c))) return listOfCodec(TYPES.text, {
    extensions: {
      listItemNonNull: !0
    }
  });else return listOfCodec(c, {
    extensions: {
      listItemNonNull: !0
    }
  });
}
const resolve29 = (i, v) => sql`${i} <> ALL(${v})`;
const resolve30 = (i, v) => sql`${i} < ${v}`;
const resolve31 = (i, v) => sql`${i} <= ${v}`;
const resolve32 = (i, v) => sql`${i} > ${v}`;
const resolve33 = (i, v) => sql`${i} >= ${v}`;
const resolve34 = (i, v) => sql`${i} LIKE ${v}`;
function escapeLikeWildcards(input) {
  if (typeof input !== "string") throw Error("Non-string input was provided to escapeLikeWildcards");else return input.split("%").join("\\%").split("_").join("\\_");
}
const resolveInput = input => `%${escapeLikeWildcards(input)}%`;
const resolve35 = (i, v) => sql`${i} NOT LIKE ${v}`;
const resolveInput2 = input => `%${escapeLikeWildcards(input)}%`;
const resolve36 = (i, v) => sql`${i} ILIKE ${v}`;
const resolveInput3 = input => `%${escapeLikeWildcards(input)}%`;
const forceTextTypesInsensitive = [TYPES.char, TYPES.bpchar];
function resolveInputCodec10(c) {
  if (c.arrayOfCodec) {
    if (forceTextTypesInsensitive.includes(resolveDomains3(c.arrayOfCodec))) return listOfCodec(TYPES.text, {
      extensions: {
        listItemNonNull: c.extensions?.listItemNonNull
      }
    });
    return c;
  } else {
    if (forceTextTypesInsensitive.includes(resolveDomains3(c))) return TYPES.text;
    return c;
  }
}
function resolveSqlIdentifier4(identifier, c) {
  if (c.arrayOfCodec && forceTextTypesInsensitive.includes(resolveDomains3(c.arrayOfCodec))) return [sql`(${identifier})::text[]`, listOfCodec(TYPES.text, {
    extensions: {
      listItemNonNull: c.extensions?.listItemNonNull
    }
  })];else if (forceTextTypesInsensitive.includes(resolveDomains3(c))) return [sql`(${identifier})::text`, TYPES.text];else return [identifier, c];
}
const resolve37 = (i, v) => sql`${i} NOT ILIKE ${v}`;
const resolveInput4 = input => `%${escapeLikeWildcards(input)}%`;
const resolve38 = (i, v) => sql`${i} LIKE ${v}`;
const resolveInput5 = input => `${escapeLikeWildcards(input)}%`;
const resolve39 = (i, v) => sql`${i} NOT LIKE ${v}`;
const resolveInput6 = input => `${escapeLikeWildcards(input)}%`;
const resolve40 = (i, v) => sql`${i} ILIKE ${v}`;
const resolveInput7 = input => `${escapeLikeWildcards(input)}%`;
const resolve41 = (i, v) => sql`${i} NOT ILIKE ${v}`;
const resolveInput8 = input => `${escapeLikeWildcards(input)}%`;
const resolve42 = (i, v) => sql`${i} LIKE ${v}`;
const resolveInput9 = input => `%${escapeLikeWildcards(input)}`;
const resolve43 = (i, v) => sql`${i} NOT LIKE ${v}`;
const resolveInput10 = input => `%${escapeLikeWildcards(input)}`;
const resolve44 = (i, v) => sql`${i} ILIKE ${v}`;
const resolveInput11 = input => `%${escapeLikeWildcards(input)}`;
const resolve45 = (i, v) => sql`${i} NOT ILIKE ${v}`;
const resolveInput12 = input => `%${escapeLikeWildcards(input)}`;
const resolve46 = (i, v) => sql`${i} LIKE ${v}`;
const resolve47 = (i, v) => sql`${i} NOT LIKE ${v}`;
const resolve48 = (i, v) => sql`${i} ILIKE ${v}`;
const resolve49 = (i, v) => sql`${i} NOT ILIKE ${v}`;
function resolveInputCodec11(inputCodec) {
  if ("equalTo" === "in" || "equalTo" === "notIn") {
    const t = resolveDomains3(inputCodec) === TYPES.citext ? inputCodec : TYPES.text;
    return listOfCodec(t, {
      extensions: {
        listItemNonNull: !0
      }
    });
  } else return resolveDomains3(inputCodec) === TYPES.citext ? inputCodec : TYPES.text;
}
function resolveSqlIdentifier5(sourceAlias, codec) {
  return resolveDomains3(codec) === TYPES.citext ? [sourceAlias, codec] : [sql`lower(${sourceAlias}::text)`, TYPES.text];
}
function resolveSqlValue4(_unused, input, inputCodec) {
  if ("equalTo" === "in" || "equalTo" === "notIn") {
    const sqlList = sqlValueWithCodec(input, inputCodec);
    if (inputCodec.arrayOfCodec === TYPES.citext) return sqlList;else return sql`(select lower(t) from unnest(${sqlList}) t)`;
  } else {
    const sqlValue = sqlValueWithCodec(input, inputCodec);
    if (inputCodec === TYPES.citext) return sqlValue;else return sql`lower(${sqlValue})`;
  }
}
function resolveInputCodec12(inputCodec) {
  if ("notEqualTo" === "in" || "notEqualTo" === "notIn") {
    const t = resolveDomains3(inputCodec) === TYPES.citext ? inputCodec : TYPES.text;
    return listOfCodec(t, {
      extensions: {
        listItemNonNull: !0
      }
    });
  } else return resolveDomains3(inputCodec) === TYPES.citext ? inputCodec : TYPES.text;
}
function resolveSqlIdentifier6(sourceAlias, codec) {
  return resolveDomains3(codec) === TYPES.citext ? [sourceAlias, codec] : [sql`lower(${sourceAlias}::text)`, TYPES.text];
}
function resolveSqlValue5(_unused, input, inputCodec) {
  if ("notEqualTo" === "in" || "notEqualTo" === "notIn") {
    const sqlList = sqlValueWithCodec(input, inputCodec);
    if (inputCodec.arrayOfCodec === TYPES.citext) return sqlList;else return sql`(select lower(t) from unnest(${sqlList}) t)`;
  } else {
    const sqlValue = sqlValueWithCodec(input, inputCodec);
    if (inputCodec === TYPES.citext) return sqlValue;else return sql`lower(${sqlValue})`;
  }
}
function resolveInputCodec13(inputCodec) {
  if ("distinctFrom" === "in" || "distinctFrom" === "notIn") {
    const t = resolveDomains3(inputCodec) === TYPES.citext ? inputCodec : TYPES.text;
    return listOfCodec(t, {
      extensions: {
        listItemNonNull: !0
      }
    });
  } else return resolveDomains3(inputCodec) === TYPES.citext ? inputCodec : TYPES.text;
}
function resolveSqlIdentifier7(sourceAlias, codec) {
  return resolveDomains3(codec) === TYPES.citext ? [sourceAlias, codec] : [sql`lower(${sourceAlias}::text)`, TYPES.text];
}
function resolveSqlValue6(_unused, input, inputCodec) {
  if ("distinctFrom" === "in" || "distinctFrom" === "notIn") {
    const sqlList = sqlValueWithCodec(input, inputCodec);
    if (inputCodec.arrayOfCodec === TYPES.citext) return sqlList;else return sql`(select lower(t) from unnest(${sqlList}) t)`;
  } else {
    const sqlValue = sqlValueWithCodec(input, inputCodec);
    if (inputCodec === TYPES.citext) return sqlValue;else return sql`lower(${sqlValue})`;
  }
}
function resolveInputCodec14(inputCodec) {
  if ("notDistinctFrom" === "in" || "notDistinctFrom" === "notIn") {
    const t = resolveDomains3(inputCodec) === TYPES.citext ? inputCodec : TYPES.text;
    return listOfCodec(t, {
      extensions: {
        listItemNonNull: !0
      }
    });
  } else return resolveDomains3(inputCodec) === TYPES.citext ? inputCodec : TYPES.text;
}
function resolveSqlIdentifier8(sourceAlias, codec) {
  return resolveDomains3(codec) === TYPES.citext ? [sourceAlias, codec] : [sql`lower(${sourceAlias}::text)`, TYPES.text];
}
function resolveSqlValue7(_unused, input, inputCodec) {
  if ("notDistinctFrom" === "in" || "notDistinctFrom" === "notIn") {
    const sqlList = sqlValueWithCodec(input, inputCodec);
    if (inputCodec.arrayOfCodec === TYPES.citext) return sqlList;else return sql`(select lower(t) from unnest(${sqlList}) t)`;
  } else {
    const sqlValue = sqlValueWithCodec(input, inputCodec);
    if (inputCodec === TYPES.citext) return sqlValue;else return sql`lower(${sqlValue})`;
  }
}
function resolveInputCodec15(inputCodec) {
  if ("in" === "in" || "in" === "notIn") {
    const t = resolveDomains3(inputCodec) === TYPES.citext ? inputCodec : TYPES.text;
    return listOfCodec(t, {
      extensions: {
        listItemNonNull: !0
      }
    });
  } else return resolveDomains3(inputCodec) === TYPES.citext ? inputCodec : TYPES.text;
}
function resolveSqlIdentifier9(sourceAlias, codec) {
  return resolveDomains3(codec) === TYPES.citext ? [sourceAlias, codec] : [sql`lower(${sourceAlias}::text)`, TYPES.text];
}
function resolveSqlValue8(_unused, input, inputCodec) {
  if ("in" === "in" || "in" === "notIn") {
    const sqlList = sqlValueWithCodec(input, inputCodec);
    if (inputCodec.arrayOfCodec === TYPES.citext) return sqlList;else return sql`(select lower(t) from unnest(${sqlList}) t)`;
  } else {
    const sqlValue = sqlValueWithCodec(input, inputCodec);
    if (inputCodec === TYPES.citext) return sqlValue;else return sql`lower(${sqlValue})`;
  }
}
function resolveInputCodec16(inputCodec) {
  if ("notIn" === "in" || "notIn" === "notIn") {
    const t = resolveDomains3(inputCodec) === TYPES.citext ? inputCodec : TYPES.text;
    return listOfCodec(t, {
      extensions: {
        listItemNonNull: !0
      }
    });
  } else return resolveDomains3(inputCodec) === TYPES.citext ? inputCodec : TYPES.text;
}
function resolveSqlIdentifier10(sourceAlias, codec) {
  return resolveDomains3(codec) === TYPES.citext ? [sourceAlias, codec] : [sql`lower(${sourceAlias}::text)`, TYPES.text];
}
function resolveSqlValue9(_unused, input, inputCodec) {
  if ("notIn" === "in" || "notIn" === "notIn") {
    const sqlList = sqlValueWithCodec(input, inputCodec);
    if (inputCodec.arrayOfCodec === TYPES.citext) return sqlList;else return sql`(select lower(t) from unnest(${sqlList}) t)`;
  } else {
    const sqlValue = sqlValueWithCodec(input, inputCodec);
    if (inputCodec === TYPES.citext) return sqlValue;else return sql`lower(${sqlValue})`;
  }
}
function resolveInputCodec17(inputCodec) {
  if ("lessThan" === "in" || "lessThan" === "notIn") {
    const t = resolveDomains3(inputCodec) === TYPES.citext ? inputCodec : TYPES.text;
    return listOfCodec(t, {
      extensions: {
        listItemNonNull: !0
      }
    });
  } else return resolveDomains3(inputCodec) === TYPES.citext ? inputCodec : TYPES.text;
}
function resolveSqlIdentifier11(sourceAlias, codec) {
  return resolveDomains3(codec) === TYPES.citext ? [sourceAlias, codec] : [sql`lower(${sourceAlias}::text)`, TYPES.text];
}
function resolveSqlValue10(_unused, input, inputCodec) {
  if ("lessThan" === "in" || "lessThan" === "notIn") {
    const sqlList = sqlValueWithCodec(input, inputCodec);
    if (inputCodec.arrayOfCodec === TYPES.citext) return sqlList;else return sql`(select lower(t) from unnest(${sqlList}) t)`;
  } else {
    const sqlValue = sqlValueWithCodec(input, inputCodec);
    if (inputCodec === TYPES.citext) return sqlValue;else return sql`lower(${sqlValue})`;
  }
}
function resolveInputCodec18(inputCodec) {
  if ("lessThanOrEqualTo" === "in" || "lessThanOrEqualTo" === "notIn") {
    const t = resolveDomains3(inputCodec) === TYPES.citext ? inputCodec : TYPES.text;
    return listOfCodec(t, {
      extensions: {
        listItemNonNull: !0
      }
    });
  } else return resolveDomains3(inputCodec) === TYPES.citext ? inputCodec : TYPES.text;
}
function resolveSqlIdentifier12(sourceAlias, codec) {
  return resolveDomains3(codec) === TYPES.citext ? [sourceAlias, codec] : [sql`lower(${sourceAlias}::text)`, TYPES.text];
}
function resolveSqlValue11(_unused, input, inputCodec) {
  if ("lessThanOrEqualTo" === "in" || "lessThanOrEqualTo" === "notIn") {
    const sqlList = sqlValueWithCodec(input, inputCodec);
    if (inputCodec.arrayOfCodec === TYPES.citext) return sqlList;else return sql`(select lower(t) from unnest(${sqlList}) t)`;
  } else {
    const sqlValue = sqlValueWithCodec(input, inputCodec);
    if (inputCodec === TYPES.citext) return sqlValue;else return sql`lower(${sqlValue})`;
  }
}
function resolveInputCodec19(inputCodec) {
  if ("greaterThan" === "in" || "greaterThan" === "notIn") {
    const t = resolveDomains3(inputCodec) === TYPES.citext ? inputCodec : TYPES.text;
    return listOfCodec(t, {
      extensions: {
        listItemNonNull: !0
      }
    });
  } else return resolveDomains3(inputCodec) === TYPES.citext ? inputCodec : TYPES.text;
}
function resolveSqlIdentifier13(sourceAlias, codec) {
  return resolveDomains3(codec) === TYPES.citext ? [sourceAlias, codec] : [sql`lower(${sourceAlias}::text)`, TYPES.text];
}
function resolveSqlValue12(_unused, input, inputCodec) {
  if ("greaterThan" === "in" || "greaterThan" === "notIn") {
    const sqlList = sqlValueWithCodec(input, inputCodec);
    if (inputCodec.arrayOfCodec === TYPES.citext) return sqlList;else return sql`(select lower(t) from unnest(${sqlList}) t)`;
  } else {
    const sqlValue = sqlValueWithCodec(input, inputCodec);
    if (inputCodec === TYPES.citext) return sqlValue;else return sql`lower(${sqlValue})`;
  }
}
function resolveInputCodec20(inputCodec) {
  if ("greaterThanOrEqualTo" === "in" || "greaterThanOrEqualTo" === "notIn") {
    const t = resolveDomains3(inputCodec) === TYPES.citext ? inputCodec : TYPES.text;
    return listOfCodec(t, {
      extensions: {
        listItemNonNull: !0
      }
    });
  } else return resolveDomains3(inputCodec) === TYPES.citext ? inputCodec : TYPES.text;
}
function resolveSqlIdentifier14(sourceAlias, codec) {
  return resolveDomains3(codec) === TYPES.citext ? [sourceAlias, codec] : [sql`lower(${sourceAlias}::text)`, TYPES.text];
}
function resolveSqlValue13(_unused, input, inputCodec) {
  if ("greaterThanOrEqualTo" === "in" || "greaterThanOrEqualTo" === "notIn") {
    const sqlList = sqlValueWithCodec(input, inputCodec);
    if (inputCodec.arrayOfCodec === TYPES.citext) return sqlList;else return sql`(select lower(t) from unnest(${sqlList}) t)`;
  } else {
    const sqlValue = sqlValueWithCodec(input, inputCodec);
    if (inputCodec === TYPES.citext) return sqlValue;else return sql`lower(${sqlValue})`;
  }
}
function assertAllowed10(value, mode) {
  if (mode === "object" && !false && isEmpty(value)) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
  if (mode === "list" && !false) {
    const arr = value;
    if (arr) {
      const l = arr.length;
      for (let i = 0; i < l; i++) if (isEmpty(arr[i])) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
    }
  }
  if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
}
function assertAllowed11(value, mode) {
  if (mode === "object" && !false && isEmpty(value)) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
  if (mode === "list" && !false) {
    const arr = value;
    if (arr) {
      const l = arr.length;
      for (let i = 0; i < l; i++) if (isEmpty(arr[i])) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
    }
  }
  if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
}
const colSpec7 = {
  fieldName: "rowId",
  attributeName: "id",
  attribute: spec_integration.attributes.id
};
const colSpec8 = {
  fieldName: "type",
  attributeName: "type",
  attribute: spec_integration.attributes.type
};
const colSpec9 = {
  fieldName: "userId",
  attributeName: "user_id",
  attribute: spec_integration.attributes.user_id
};
function assertAllowed12(value, mode) {
  if (mode === "object" && !false && isEmpty(value)) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
  if (mode === "list" && !false) {
    const arr = value;
    if (arr) {
      const l = arr.length;
      for (let i = 0; i < l; i++) if (isEmpty(arr[i])) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
    }
  }
  if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
}
function assertAllowed13(value, mode) {
  if (mode === "object" && !false && isEmpty(value)) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
  if (mode === "list" && !false) {
    const arr = value;
    if (arr) {
      const l = arr.length;
      for (let i = 0; i < l; i++) if (isEmpty(arr[i])) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
    }
  }
  if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
}
const specFromArgs_User = args => {
  const $nodeId = args.getRaw(["input", "id"]);
  return specFromNodeId(nodeIdHandlerByTypeName.User, $nodeId);
};
const specFromArgs_Integration = args => {
  const $nodeId = args.getRaw(["input", "id"]);
  return specFromNodeId(nodeIdHandlerByTypeName.Integration, $nodeId);
};
const specFromArgs_Workflow = args => {
  const $nodeId = args.getRaw(["input", "id"]);
  return specFromNodeId(nodeIdHandlerByTypeName.Workflow, $nodeId);
};
const specFromArgs_User2 = args => {
  const $nodeId = args.getRaw(["input", "id"]);
  return specFromNodeId(nodeIdHandlerByTypeName.User, $nodeId);
};
const specFromArgs_Integration2 = args => {
  const $nodeId = args.getRaw(["input", "id"]);
  return specFromNodeId(nodeIdHandlerByTypeName.Integration, $nodeId);
};
const specFromArgs_Workflow2 = args => {
  const $nodeId = args.getRaw(["input", "id"]);
  return specFromNodeId(nodeIdHandlerByTypeName.Workflow, $nodeId);
};
export const typeDefs = /* GraphQL */`"""The root query type which gives access points into the data universe."""
type Query implements Node {
  """
  Exposes the root query type nested one level down. This is helpful for Relay 1
  which can only query top level fields if they are in a particular form.
  """
  query: Query!

  """
  The root query type must be a \`Node\` to work well with Relay 1 mutations. This just resolves to \`query\`.
  """
  id: ID!

  """Fetches an object given its globally unique \`ID\`."""
  node(
    """The globally unique \`ID\`."""
    id: ID!
  ): Node

  """Get a single \`User\`."""
  user(rowId: UUID!): User

  """Get a single \`User\`."""
  userByEmail(email: String!): User

  """Get a single \`User\`."""
  userByIdentityProviderId(identityProviderId: UUID!): User

  """Get a single \`Integration\`."""
  integration(rowId: UUID!): Integration

  """Get a single \`Workflow\`."""
  workflow(rowId: UUID!): Workflow

  """Reads a single \`User\` using its globally unique \`ID\`."""
  userById(
    """The globally unique \`ID\` to be used in selecting a single \`User\`."""
    id: ID!
  ): User

  """Reads a single \`Integration\` using its globally unique \`ID\`."""
  integrationById(
    """
    The globally unique \`ID\` to be used in selecting a single \`Integration\`.
    """
    id: ID!
  ): Integration

  """Reads a single \`Workflow\` using its globally unique \`ID\`."""
  workflowById(
    """The globally unique \`ID\` to be used in selecting a single \`Workflow\`."""
    id: ID!
  ): Workflow

  """Reads and enables pagination through a set of \`User\`."""
  users(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: UserCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: UserFilter

    """The method to use when ordering \`User\`."""
    orderBy: [UserOrderBy!] = [PRIMARY_KEY_ASC]
  ): UserConnection

  """Reads and enables pagination through a set of \`Integration\`."""
  integrations(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: IntegrationCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: IntegrationFilter

    """The method to use when ordering \`Integration\`."""
    orderBy: [IntegrationOrderBy!] = [PRIMARY_KEY_ASC]
  ): IntegrationConnection

  """Reads and enables pagination through a set of \`Workflow\`."""
  workflows(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: WorkflowCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: WorkflowFilter

    """The method to use when ordering \`Workflow\`."""
    orderBy: [WorkflowOrderBy!] = [PRIMARY_KEY_ASC]
  ): WorkflowConnection
}

"""An object with a globally unique \`ID\`."""
interface Node {
  """
  A globally unique identifier. Can be used in various places throughout the system to identify this single value.
  """
  id: ID!
}

type User implements Node {
  """
  A globally unique identifier. Can be used in various places throughout the system to identify this single value.
  """
  id: ID!
  rowId: UUID!
  identityProviderId: UUID!
  createdAt: Datetime
  updatedAt: Datetime
  email: String!
  name: String!
  avatar: String
  isOnboarded: Boolean!
  theme: String
  planType: String!

  """Reads and enables pagination through a set of \`Workflow\`."""
  workflows(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: WorkflowCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: WorkflowFilter

    """The method to use when ordering \`Workflow\`."""
    orderBy: [WorkflowOrderBy!] = [PRIMARY_KEY_ASC]
  ): WorkflowConnection!

  """Reads and enables pagination through a set of \`Integration\`."""
  integrations(
    """Only read the first \`n\` values of the set."""
    first: Int

    """Only read the last \`n\` values of the set."""
    last: Int

    """
    Skip the first \`n\` values from our \`after\` cursor, an alternative to cursor
    based pagination. May not be used with \`last\`.
    """
    offset: Int

    """Read all values in the set before (above) this cursor."""
    before: Cursor

    """Read all values in the set after (below) this cursor."""
    after: Cursor

    """
    A condition to be used in determining which values should be returned by the collection.
    """
    condition: IntegrationCondition

    """
    A filter to be used in determining which values should be returned by the collection.
    """
    filter: IntegrationFilter

    """The method to use when ordering \`Integration\`."""
    orderBy: [IntegrationOrderBy!] = [PRIMARY_KEY_ASC]
  ): IntegrationConnection!
}

"""
A universally unique identifier as defined by [RFC 4122](https://tools.ietf.org/html/rfc4122).
"""
scalar UUID

"""
A point in time as described by the [ISO
8601](https://en.wikipedia.org/wiki/ISO_8601) and, if it has a timezone, [RFC
3339](https://datatracker.ietf.org/doc/html/rfc3339) standards. Input values
that do not conform to both ISO 8601 and RFC 3339 may be coerced, which may lead
to unexpected results.
"""
scalar Datetime

"""A connection to a list of \`Workflow\` values."""
type WorkflowConnection {
  """A list of \`Workflow\` objects."""
  nodes: [Workflow]!

  """
  A list of edges which contains the \`Workflow\` and cursor to aid in pagination.
  """
  edges: [WorkflowEdge]!

  """Information to aid in pagination."""
  pageInfo: PageInfo!

  """The count of *all* \`Workflow\` you could get from the connection."""
  totalCount: Int!
}

type Workflow implements Node {
  """
  A globally unique identifier. Can be used in various places throughout the system to identify this single value.
  """
  id: ID!
  rowId: UUID!
  name: String!
  description: String
  definition: JSON!
  isActive: Boolean!
  userId: UUID!
  createdAt: Datetime
  updatedAt: Datetime

  """Reads a single \`User\` that is related to this \`Workflow\`."""
  user: User
}

"""
Represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf).
"""
scalar JSON

"""A \`Workflow\` edge in the connection."""
type WorkflowEdge {
  """A cursor for use in pagination."""
  cursor: Cursor

  """The \`Workflow\` at the end of the edge."""
  node: Workflow
}

"""A location in a connection that can be used for resuming pagination."""
scalar Cursor

"""Information about pagination in a connection."""
type PageInfo {
  """When paginating forwards, are there more items?"""
  hasNextPage: Boolean!

  """When paginating backwards, are there more items?"""
  hasPreviousPage: Boolean!

  """When paginating backwards, the cursor to continue."""
  startCursor: Cursor

  """When paginating forwards, the cursor to continue."""
  endCursor: Cursor
}

"""
A condition to be used against \`Workflow\` object types. All fields are tested
for equality and combined with a logical ‘and.’
"""
input WorkflowCondition {
  """Checks for equality with the object’s \`rowId\` field."""
  rowId: UUID

  """Checks for equality with the object’s \`isActive\` field."""
  isActive: Boolean

  """Checks for equality with the object’s \`userId\` field."""
  userId: UUID
}

"""
A filter to be used against \`Workflow\` object types. All fields are combined with a logical ‘and.’
"""
input WorkflowFilter {
  """Filter by the object’s \`rowId\` field."""
  rowId: UUIDFilter

  """Filter by the object’s \`isActive\` field."""
  isActive: BooleanFilter

  """Filter by the object’s \`userId\` field."""
  userId: UUIDFilter

  """Filter by the object’s \`user\` relation."""
  user: UserFilter

  """Checks for all expressions in this list."""
  and: [WorkflowFilter!]

  """Checks for any expressions in this list."""
  or: [WorkflowFilter!]

  """Negates the expression."""
  not: WorkflowFilter
}

"""
A filter to be used against UUID fields. All fields are combined with a logical ‘and.’
"""
input UUIDFilter {
  """
  Is null (if \`true\` is specified) or is not null (if \`false\` is specified).
  """
  isNull: Boolean

  """Equal to the specified value."""
  equalTo: UUID

  """Not equal to the specified value."""
  notEqualTo: UUID

  """
  Not equal to the specified value, treating null like an ordinary value.
  """
  distinctFrom: UUID

  """Equal to the specified value, treating null like an ordinary value."""
  notDistinctFrom: UUID

  """Included in the specified list."""
  in: [UUID!]

  """Not included in the specified list."""
  notIn: [UUID!]

  """Less than the specified value."""
  lessThan: UUID

  """Less than or equal to the specified value."""
  lessThanOrEqualTo: UUID

  """Greater than the specified value."""
  greaterThan: UUID

  """Greater than or equal to the specified value."""
  greaterThanOrEqualTo: UUID
}

"""
A filter to be used against Boolean fields. All fields are combined with a logical ‘and.’
"""
input BooleanFilter {
  """
  Is null (if \`true\` is specified) or is not null (if \`false\` is specified).
  """
  isNull: Boolean

  """Equal to the specified value."""
  equalTo: Boolean

  """Not equal to the specified value."""
  notEqualTo: Boolean

  """
  Not equal to the specified value, treating null like an ordinary value.
  """
  distinctFrom: Boolean

  """Equal to the specified value, treating null like an ordinary value."""
  notDistinctFrom: Boolean

  """Included in the specified list."""
  in: [Boolean!]

  """Not included in the specified list."""
  notIn: [Boolean!]

  """Less than the specified value."""
  lessThan: Boolean

  """Less than or equal to the specified value."""
  lessThanOrEqualTo: Boolean

  """Greater than the specified value."""
  greaterThan: Boolean

  """Greater than or equal to the specified value."""
  greaterThanOrEqualTo: Boolean
}

"""
A filter to be used against \`User\` object types. All fields are combined with a logical ‘and.’
"""
input UserFilter {
  """Filter by the object’s \`rowId\` field."""
  rowId: UUIDFilter

  """Filter by the object’s \`identityProviderId\` field."""
  identityProviderId: UUIDFilter

  """Filter by the object’s \`email\` field."""
  email: StringFilter

  """Filter by the object’s \`workflows\` relation."""
  workflows: UserToManyWorkflowFilter

  """Some related \`workflows\` exist."""
  workflowsExist: Boolean

  """Filter by the object’s \`integrations\` relation."""
  integrations: UserToManyIntegrationFilter

  """Some related \`integrations\` exist."""
  integrationsExist: Boolean

  """Checks for all expressions in this list."""
  and: [UserFilter!]

  """Checks for any expressions in this list."""
  or: [UserFilter!]

  """Negates the expression."""
  not: UserFilter
}

"""
A filter to be used against String fields. All fields are combined with a logical ‘and.’
"""
input StringFilter {
  """
  Is null (if \`true\` is specified) or is not null (if \`false\` is specified).
  """
  isNull: Boolean

  """Equal to the specified value."""
  equalTo: String

  """Not equal to the specified value."""
  notEqualTo: String

  """
  Not equal to the specified value, treating null like an ordinary value.
  """
  distinctFrom: String

  """Equal to the specified value, treating null like an ordinary value."""
  notDistinctFrom: String

  """Included in the specified list."""
  in: [String!]

  """Not included in the specified list."""
  notIn: [String!]

  """Less than the specified value."""
  lessThan: String

  """Less than or equal to the specified value."""
  lessThanOrEqualTo: String

  """Greater than the specified value."""
  greaterThan: String

  """Greater than or equal to the specified value."""
  greaterThanOrEqualTo: String

  """Contains the specified string (case-sensitive)."""
  includes: String

  """Does not contain the specified string (case-sensitive)."""
  notIncludes: String

  """Contains the specified string (case-insensitive)."""
  includesInsensitive: String

  """Does not contain the specified string (case-insensitive)."""
  notIncludesInsensitive: String

  """Starts with the specified string (case-sensitive)."""
  startsWith: String

  """Does not start with the specified string (case-sensitive)."""
  notStartsWith: String

  """Starts with the specified string (case-insensitive)."""
  startsWithInsensitive: String

  """Does not start with the specified string (case-insensitive)."""
  notStartsWithInsensitive: String

  """Ends with the specified string (case-sensitive)."""
  endsWith: String

  """Does not end with the specified string (case-sensitive)."""
  notEndsWith: String

  """Ends with the specified string (case-insensitive)."""
  endsWithInsensitive: String

  """Does not end with the specified string (case-insensitive)."""
  notEndsWithInsensitive: String

  """
  Matches the specified pattern (case-sensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.
  """
  like: String

  """
  Does not match the specified pattern (case-sensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.
  """
  notLike: String

  """
  Matches the specified pattern (case-insensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.
  """
  likeInsensitive: String

  """
  Does not match the specified pattern (case-insensitive). An underscore (_) matches any single character; a percent sign (%) matches any sequence of zero or more characters.
  """
  notLikeInsensitive: String

  """Equal to the specified value (case-insensitive)."""
  equalToInsensitive: String

  """Not equal to the specified value (case-insensitive)."""
  notEqualToInsensitive: String

  """
  Not equal to the specified value, treating null like an ordinary value (case-insensitive).
  """
  distinctFromInsensitive: String

  """
  Equal to the specified value, treating null like an ordinary value (case-insensitive).
  """
  notDistinctFromInsensitive: String

  """Included in the specified list (case-insensitive)."""
  inInsensitive: [String!]

  """Not included in the specified list (case-insensitive)."""
  notInInsensitive: [String!]

  """Less than the specified value (case-insensitive)."""
  lessThanInsensitive: String

  """Less than or equal to the specified value (case-insensitive)."""
  lessThanOrEqualToInsensitive: String

  """Greater than the specified value (case-insensitive)."""
  greaterThanInsensitive: String

  """Greater than or equal to the specified value (case-insensitive)."""
  greaterThanOrEqualToInsensitive: String
}

"""
A filter to be used against many \`Workflow\` object types. All fields are combined with a logical ‘and.’
"""
input UserToManyWorkflowFilter {
  """
  Every related \`Workflow\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  every: WorkflowFilter

  """
  Some related \`Workflow\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  some: WorkflowFilter

  """
  No related \`Workflow\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  none: WorkflowFilter
}

"""
A filter to be used against many \`Integration\` object types. All fields are combined with a logical ‘and.’
"""
input UserToManyIntegrationFilter {
  """
  Every related \`Integration\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  every: IntegrationFilter

  """
  Some related \`Integration\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  some: IntegrationFilter

  """
  No related \`Integration\` matches the filter criteria. All fields are combined with a logical ‘and.’
  """
  none: IntegrationFilter
}

"""
A filter to be used against \`Integration\` object types. All fields are combined with a logical ‘and.’
"""
input IntegrationFilter {
  """Filter by the object’s \`rowId\` field."""
  rowId: UUIDFilter

  """Filter by the object’s \`type\` field."""
  type: StringFilter

  """Filter by the object’s \`userId\` field."""
  userId: UUIDFilter

  """Filter by the object’s \`user\` relation."""
  user: UserFilter

  """Checks for all expressions in this list."""
  and: [IntegrationFilter!]

  """Checks for any expressions in this list."""
  or: [IntegrationFilter!]

  """Negates the expression."""
  not: IntegrationFilter
}

"""Methods to use when ordering \`Workflow\`."""
enum WorkflowOrderBy {
  NATURAL
  PRIMARY_KEY_ASC
  PRIMARY_KEY_DESC
  ROW_ID_ASC
  ROW_ID_DESC
  IS_ACTIVE_ASC
  IS_ACTIVE_DESC
  USER_ID_ASC
  USER_ID_DESC
}

"""A connection to a list of \`Integration\` values."""
type IntegrationConnection {
  """A list of \`Integration\` objects."""
  nodes: [Integration]!

  """
  A list of edges which contains the \`Integration\` and cursor to aid in pagination.
  """
  edges: [IntegrationEdge]!

  """Information to aid in pagination."""
  pageInfo: PageInfo!

  """The count of *all* \`Integration\` you could get from the connection."""
  totalCount: Int!
}

type Integration implements Node {
  """
  A globally unique identifier. Can be used in various places throughout the system to identify this single value.
  """
  id: ID!
  rowId: UUID!
  type: String!
  name: String!
  isEnabled: Boolean!
  config: JSON!
  userId: UUID!
  createdAt: Datetime
  updatedAt: Datetime

  """Reads a single \`User\` that is related to this \`Integration\`."""
  user: User
}

"""A \`Integration\` edge in the connection."""
type IntegrationEdge {
  """A cursor for use in pagination."""
  cursor: Cursor

  """The \`Integration\` at the end of the edge."""
  node: Integration
}

"""
A condition to be used against \`Integration\` object types. All fields are tested
for equality and combined with a logical ‘and.’
"""
input IntegrationCondition {
  """Checks for equality with the object’s \`rowId\` field."""
  rowId: UUID

  """Checks for equality with the object’s \`type\` field."""
  type: String

  """Checks for equality with the object’s \`userId\` field."""
  userId: UUID
}

"""Methods to use when ordering \`Integration\`."""
enum IntegrationOrderBy {
  NATURAL
  PRIMARY_KEY_ASC
  PRIMARY_KEY_DESC
  ROW_ID_ASC
  ROW_ID_DESC
  TYPE_ASC
  TYPE_DESC
  USER_ID_ASC
  USER_ID_DESC
}

"""A connection to a list of \`User\` values."""
type UserConnection {
  """A list of \`User\` objects."""
  nodes: [User]!

  """
  A list of edges which contains the \`User\` and cursor to aid in pagination.
  """
  edges: [UserEdge]!

  """Information to aid in pagination."""
  pageInfo: PageInfo!

  """The count of *all* \`User\` you could get from the connection."""
  totalCount: Int!
}

"""A \`User\` edge in the connection."""
type UserEdge {
  """A cursor for use in pagination."""
  cursor: Cursor

  """The \`User\` at the end of the edge."""
  node: User
}

"""
A condition to be used against \`User\` object types. All fields are tested for equality and combined with a logical ‘and.’
"""
input UserCondition {
  """Checks for equality with the object’s \`rowId\` field."""
  rowId: UUID

  """Checks for equality with the object’s \`identityProviderId\` field."""
  identityProviderId: UUID

  """Checks for equality with the object’s \`email\` field."""
  email: String
}

"""Methods to use when ordering \`User\`."""
enum UserOrderBy {
  NATURAL
  PRIMARY_KEY_ASC
  PRIMARY_KEY_DESC
  ROW_ID_ASC
  ROW_ID_DESC
  IDENTITY_PROVIDER_ID_ASC
  IDENTITY_PROVIDER_ID_DESC
  EMAIL_ASC
  EMAIL_DESC
}

"""
The root mutation type which contains root level fields which mutate data.
"""
type Mutation {
  """Creates a single \`User\`."""
  createUser(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: CreateUserInput!
  ): CreateUserPayload

  """Creates a single \`Integration\`."""
  createIntegration(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: CreateIntegrationInput!
  ): CreateIntegrationPayload

  """Creates a single \`Workflow\`."""
  createWorkflow(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: CreateWorkflowInput!
  ): CreateWorkflowPayload

  """Updates a single \`User\` using its globally unique id and a patch."""
  updateUserById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateUserByIdInput!
  ): UpdateUserPayload

  """Updates a single \`User\` using a unique key and a patch."""
  updateUser(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateUserInput!
  ): UpdateUserPayload

  """Updates a single \`User\` using a unique key and a patch."""
  updateUserByEmail(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateUserByEmailInput!
  ): UpdateUserPayload

  """Updates a single \`User\` using a unique key and a patch."""
  updateUserByIdentityProviderId(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateUserByIdentityProviderIdInput!
  ): UpdateUserPayload

  """
  Updates a single \`Integration\` using its globally unique id and a patch.
  """
  updateIntegrationById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateIntegrationByIdInput!
  ): UpdateIntegrationPayload

  """Updates a single \`Integration\` using a unique key and a patch."""
  updateIntegration(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateIntegrationInput!
  ): UpdateIntegrationPayload

  """Updates a single \`Workflow\` using its globally unique id and a patch."""
  updateWorkflowById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateWorkflowByIdInput!
  ): UpdateWorkflowPayload

  """Updates a single \`Workflow\` using a unique key and a patch."""
  updateWorkflow(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: UpdateWorkflowInput!
  ): UpdateWorkflowPayload

  """Deletes a single \`User\` using its globally unique id."""
  deleteUserById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteUserByIdInput!
  ): DeleteUserPayload

  """Deletes a single \`User\` using a unique key."""
  deleteUser(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteUserInput!
  ): DeleteUserPayload

  """Deletes a single \`User\` using a unique key."""
  deleteUserByEmail(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteUserByEmailInput!
  ): DeleteUserPayload

  """Deletes a single \`User\` using a unique key."""
  deleteUserByIdentityProviderId(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteUserByIdentityProviderIdInput!
  ): DeleteUserPayload

  """Deletes a single \`Integration\` using its globally unique id."""
  deleteIntegrationById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteIntegrationByIdInput!
  ): DeleteIntegrationPayload

  """Deletes a single \`Integration\` using a unique key."""
  deleteIntegration(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteIntegrationInput!
  ): DeleteIntegrationPayload

  """Deletes a single \`Workflow\` using its globally unique id."""
  deleteWorkflowById(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteWorkflowByIdInput!
  ): DeleteWorkflowPayload

  """Deletes a single \`Workflow\` using a unique key."""
  deleteWorkflow(
    """
    The exclusive input argument for this mutation. An object type, make sure to see documentation for this object’s fields.
    """
    input: DeleteWorkflowInput!
  ): DeleteWorkflowPayload
}

"""The output of our create \`User\` mutation."""
type CreateUserPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`User\` that was created by this mutation."""
  user: User

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`User\`. May be used by Relay 1."""
  userEdge(
    """The method to use when ordering \`User\`."""
    orderBy: [UserOrderBy!]! = [PRIMARY_KEY_ASC]
  ): UserEdge
}

"""All input for the create \`User\` mutation."""
input CreateUserInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """The \`User\` to be created by this mutation."""
  user: UserInput!
}

"""An input for mutations affecting \`User\`"""
input UserInput {
  rowId: UUID
  identityProviderId: UUID!
  createdAt: Datetime
  updatedAt: Datetime
  email: String!
  name: String!
  avatar: String
  isOnboarded: Boolean
  theme: String
  planType: String
}

"""The output of our create \`Integration\` mutation."""
type CreateIntegrationPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`Integration\` that was created by this mutation."""
  integration: Integration

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`Integration\`. May be used by Relay 1."""
  integrationEdge(
    """The method to use when ordering \`Integration\`."""
    orderBy: [IntegrationOrderBy!]! = [PRIMARY_KEY_ASC]
  ): IntegrationEdge
}

"""All input for the create \`Integration\` mutation."""
input CreateIntegrationInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """The \`Integration\` to be created by this mutation."""
  integration: IntegrationInput!
}

"""An input for mutations affecting \`Integration\`"""
input IntegrationInput {
  rowId: UUID
  type: String!
  name: String!
  isEnabled: Boolean
  config: JSON
  userId: UUID!
  createdAt: Datetime
  updatedAt: Datetime
}

"""The output of our create \`Workflow\` mutation."""
type CreateWorkflowPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`Workflow\` that was created by this mutation."""
  workflow: Workflow

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`Workflow\`. May be used by Relay 1."""
  workflowEdge(
    """The method to use when ordering \`Workflow\`."""
    orderBy: [WorkflowOrderBy!]! = [PRIMARY_KEY_ASC]
  ): WorkflowEdge
}

"""All input for the create \`Workflow\` mutation."""
input CreateWorkflowInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """The \`Workflow\` to be created by this mutation."""
  workflow: WorkflowInput!
}

"""An input for mutations affecting \`Workflow\`"""
input WorkflowInput {
  rowId: UUID
  name: String!
  description: String
  definition: JSON!
  isActive: Boolean
  userId: UUID!
  createdAt: Datetime
  updatedAt: Datetime
}

"""The output of our update \`User\` mutation."""
type UpdateUserPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`User\` that was updated by this mutation."""
  user: User

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`User\`. May be used by Relay 1."""
  userEdge(
    """The method to use when ordering \`User\`."""
    orderBy: [UserOrderBy!]! = [PRIMARY_KEY_ASC]
  ): UserEdge
}

"""All input for the \`updateUserById\` mutation."""
input UpdateUserByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`User\` to be updated.
  """
  id: ID!

  """
  An object where the defined keys will be set on the \`User\` being updated.
  """
  patch: UserPatch!
}

"""Represents an update to a \`User\`. Fields that are set will be updated."""
input UserPatch {
  rowId: UUID
  identityProviderId: UUID
  createdAt: Datetime
  updatedAt: Datetime
  email: String
  name: String
  avatar: String
  isOnboarded: Boolean
  theme: String
  planType: String
}

"""All input for the \`updateUser\` mutation."""
input UpdateUserInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!

  """
  An object where the defined keys will be set on the \`User\` being updated.
  """
  patch: UserPatch!
}

"""All input for the \`updateUserByEmail\` mutation."""
input UpdateUserByEmailInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  email: String!

  """
  An object where the defined keys will be set on the \`User\` being updated.
  """
  patch: UserPatch!
}

"""All input for the \`updateUserByIdentityProviderId\` mutation."""
input UpdateUserByIdentityProviderIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  identityProviderId: UUID!

  """
  An object where the defined keys will be set on the \`User\` being updated.
  """
  patch: UserPatch!
}

"""The output of our update \`Integration\` mutation."""
type UpdateIntegrationPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`Integration\` that was updated by this mutation."""
  integration: Integration

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`Integration\`. May be used by Relay 1."""
  integrationEdge(
    """The method to use when ordering \`Integration\`."""
    orderBy: [IntegrationOrderBy!]! = [PRIMARY_KEY_ASC]
  ): IntegrationEdge
}

"""All input for the \`updateIntegrationById\` mutation."""
input UpdateIntegrationByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`Integration\` to be updated.
  """
  id: ID!

  """
  An object where the defined keys will be set on the \`Integration\` being updated.
  """
  patch: IntegrationPatch!
}

"""
Represents an update to a \`Integration\`. Fields that are set will be updated.
"""
input IntegrationPatch {
  rowId: UUID
  type: String
  name: String
  isEnabled: Boolean
  config: JSON
  userId: UUID
  createdAt: Datetime
  updatedAt: Datetime
}

"""All input for the \`updateIntegration\` mutation."""
input UpdateIntegrationInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!

  """
  An object where the defined keys will be set on the \`Integration\` being updated.
  """
  patch: IntegrationPatch!
}

"""The output of our update \`Workflow\` mutation."""
type UpdateWorkflowPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`Workflow\` that was updated by this mutation."""
  workflow: Workflow

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`Workflow\`. May be used by Relay 1."""
  workflowEdge(
    """The method to use when ordering \`Workflow\`."""
    orderBy: [WorkflowOrderBy!]! = [PRIMARY_KEY_ASC]
  ): WorkflowEdge
}

"""All input for the \`updateWorkflowById\` mutation."""
input UpdateWorkflowByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`Workflow\` to be updated.
  """
  id: ID!

  """
  An object where the defined keys will be set on the \`Workflow\` being updated.
  """
  patch: WorkflowPatch!
}

"""
Represents an update to a \`Workflow\`. Fields that are set will be updated.
"""
input WorkflowPatch {
  rowId: UUID
  name: String
  description: String
  definition: JSON
  isActive: Boolean
  userId: UUID
  createdAt: Datetime
  updatedAt: Datetime
}

"""All input for the \`updateWorkflow\` mutation."""
input UpdateWorkflowInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!

  """
  An object where the defined keys will be set on the \`Workflow\` being updated.
  """
  patch: WorkflowPatch!
}

"""The output of our delete \`User\` mutation."""
type DeleteUserPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`User\` that was deleted by this mutation."""
  user: User
  deletedUserId: ID

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`User\`. May be used by Relay 1."""
  userEdge(
    """The method to use when ordering \`User\`."""
    orderBy: [UserOrderBy!]! = [PRIMARY_KEY_ASC]
  ): UserEdge
}

"""All input for the \`deleteUserById\` mutation."""
input DeleteUserByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`User\` to be deleted.
  """
  id: ID!
}

"""All input for the \`deleteUser\` mutation."""
input DeleteUserInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!
}

"""All input for the \`deleteUserByEmail\` mutation."""
input DeleteUserByEmailInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  email: String!
}

"""All input for the \`deleteUserByIdentityProviderId\` mutation."""
input DeleteUserByIdentityProviderIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  identityProviderId: UUID!
}

"""The output of our delete \`Integration\` mutation."""
type DeleteIntegrationPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`Integration\` that was deleted by this mutation."""
  integration: Integration
  deletedIntegrationId: ID

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`Integration\`. May be used by Relay 1."""
  integrationEdge(
    """The method to use when ordering \`Integration\`."""
    orderBy: [IntegrationOrderBy!]! = [PRIMARY_KEY_ASC]
  ): IntegrationEdge
}

"""All input for the \`deleteIntegrationById\` mutation."""
input DeleteIntegrationByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`Integration\` to be deleted.
  """
  id: ID!
}

"""All input for the \`deleteIntegration\` mutation."""
input DeleteIntegrationInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!
}

"""The output of our delete \`Workflow\` mutation."""
type DeleteWorkflowPayload {
  """
  The exact same \`clientMutationId\` that was provided in the mutation input,
  unchanged and unused. May be used by a client to track mutations.
  """
  clientMutationId: String

  """The \`Workflow\` that was deleted by this mutation."""
  workflow: Workflow
  deletedWorkflowId: ID

  """
  Our root query field type. Allows us to run any query from our mutation payload.
  """
  query: Query

  """An edge for our \`Workflow\`. May be used by Relay 1."""
  workflowEdge(
    """The method to use when ordering \`Workflow\`."""
    orderBy: [WorkflowOrderBy!]! = [PRIMARY_KEY_ASC]
  ): WorkflowEdge
}

"""All input for the \`deleteWorkflowById\` mutation."""
input DeleteWorkflowByIdInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String

  """
  The globally unique \`ID\` which will identify a single \`Workflow\` to be deleted.
  """
  id: ID!
}

"""All input for the \`deleteWorkflow\` mutation."""
input DeleteWorkflowInput {
  """
  An arbitrary string value with no semantic meaning. Will be included in the
  payload verbatim. May be used to track mutations by the client.
  """
  clientMutationId: String
  rowId: UUID!
}`;
export const plans = {
  Query: {
    __assertStep() {
      return !0;
    },
    query() {
      return rootValue();
    },
    id($parent) {
      const specifier = handler.plan($parent);
      return lambda(specifier, nodeIdCodecs[handler.codec.name].encode);
    },
    node(_$root, args) {
      return node(nodeIdHandlerByTypeName, args.getRaw("id"));
    },
    user(_$root, {
      $rowId
    }) {
      return pgResource_userPgResource.get({
        id: $rowId
      });
    },
    userByEmail(_$root, {
      $email
    }) {
      return pgResource_userPgResource.get({
        email: $email
      });
    },
    userByIdentityProviderId(_$root, {
      $identityProviderId
    }) {
      return pgResource_userPgResource.get({
        identity_provider_id: $identityProviderId
      });
    },
    integration(_$root, {
      $rowId
    }) {
      return pgResource_integrationPgResource.get({
        id: $rowId
      });
    },
    workflow(_$root, {
      $rowId
    }) {
      return pgResource_workflowPgResource.get({
        id: $rowId
      });
    },
    userById(_$parent, args) {
      const $nodeId = args.getRaw("id");
      return nodeFetcher_User($nodeId);
    },
    integrationById(_$parent, args) {
      const $nodeId = args.getRaw("id");
      return nodeFetcher_Integration($nodeId);
    },
    workflowById(_$parent, args) {
      const $nodeId = args.getRaw("id");
      return nodeFetcher_Workflow($nodeId);
    },
    users: {
      plan() {
        return connection(pgResource_userPgResource.find());
      },
      args: {
        first(_, $connection, arg) {
          $connection.setFirst(arg.getRaw());
        },
        last(_, $connection, val) {
          $connection.setLast(val.getRaw());
        },
        offset(_, $connection, val) {
          $connection.setOffset(val.getRaw());
        },
        before(_, $connection, val) {
          $connection.setBefore(val.getRaw());
        },
        after(_, $connection, val) {
          $connection.setAfter(val.getRaw());
        },
        condition(_condition, $connection, arg) {
          const $select = $connection.getSubplan();
          arg.apply($select, qbWhereBuilder);
        },
        filter(_, $connection, fieldArg) {
          const $pgSelect = $connection.getSubplan();
          fieldArg.apply($pgSelect, (queryBuilder, value) => {
            assertAllowed(value, "object");
            if (value == null) return;
            const condition = new PgCondition(queryBuilder);
            return condition;
          });
        },
        orderBy(parent, $connection, value) {
          const $select = $connection.getSubplan();
          value.apply($select);
        }
      }
    },
    integrations: {
      plan() {
        return connection(pgResource_integrationPgResource.find());
      },
      args: {
        first(_, $connection, arg) {
          $connection.setFirst(arg.getRaw());
        },
        last(_, $connection, val) {
          $connection.setLast(val.getRaw());
        },
        offset(_, $connection, val) {
          $connection.setOffset(val.getRaw());
        },
        before(_, $connection, val) {
          $connection.setBefore(val.getRaw());
        },
        after(_, $connection, val) {
          $connection.setAfter(val.getRaw());
        },
        condition(_condition, $connection, arg) {
          const $select = $connection.getSubplan();
          arg.apply($select, qbWhereBuilder);
        },
        filter(_, $connection, fieldArg) {
          const $pgSelect = $connection.getSubplan();
          fieldArg.apply($pgSelect, (queryBuilder, value) => {
            assertAllowed2(value, "object");
            if (value == null) return;
            const condition = new PgCondition(queryBuilder);
            return condition;
          });
        },
        orderBy(parent, $connection, value) {
          const $select = $connection.getSubplan();
          value.apply($select);
        }
      }
    },
    workflows: {
      plan() {
        return connection(pgResource_workflowPgResource.find());
      },
      args: {
        first(_, $connection, arg) {
          $connection.setFirst(arg.getRaw());
        },
        last(_, $connection, val) {
          $connection.setLast(val.getRaw());
        },
        offset(_, $connection, val) {
          $connection.setOffset(val.getRaw());
        },
        before(_, $connection, val) {
          $connection.setBefore(val.getRaw());
        },
        after(_, $connection, val) {
          $connection.setAfter(val.getRaw());
        },
        condition(_condition, $connection, arg) {
          const $select = $connection.getSubplan();
          arg.apply($select, qbWhereBuilder);
        },
        filter(_, $connection, fieldArg) {
          const $pgSelect = $connection.getSubplan();
          fieldArg.apply($pgSelect, (queryBuilder, value) => {
            assertAllowed3(value, "object");
            if (value == null) return;
            const condition = new PgCondition(queryBuilder);
            return condition;
          });
        },
        orderBy(parent, $connection, value) {
          const $select = $connection.getSubplan();
          value.apply($select);
        }
      }
    }
  },
  User: {
    __assertStep: assertPgClassSingleStep,
    id($parent) {
      const specifier = nodeIdHandlerByTypeName.User.plan($parent);
      return lambda(specifier, nodeIdCodecs[nodeIdHandlerByTypeName.User.codec.name].encode);
    },
    rowId($record) {
      return $record.get("id");
    },
    identityProviderId($record) {
      return $record.get("identity_provider_id");
    },
    createdAt($record) {
      return $record.get("created_at");
    },
    updatedAt($record) {
      return $record.get("updated_at");
    },
    isOnboarded($record) {
      return $record.get("is_onboarded");
    },
    planType($record) {
      return $record.get("plan_type");
    },
    workflows: {
      plan($record) {
        const $records = pgResource_workflowPgResource.find({
          user_id: $record.get("id")
        });
        return connection($records);
      },
      args: {
        first(_, $connection, arg) {
          $connection.setFirst(arg.getRaw());
        },
        last(_, $connection, val) {
          $connection.setLast(val.getRaw());
        },
        offset(_, $connection, val) {
          $connection.setOffset(val.getRaw());
        },
        before(_, $connection, val) {
          $connection.setBefore(val.getRaw());
        },
        after(_, $connection, val) {
          $connection.setAfter(val.getRaw());
        },
        condition(_condition, $connection, arg) {
          const $select = $connection.getSubplan();
          arg.apply($select, qbWhereBuilder);
        },
        filter(_, $connection, fieldArg) {
          const $pgSelect = $connection.getSubplan();
          fieldArg.apply($pgSelect, (queryBuilder, value) => {
            assertAllowed4(value, "object");
            if (value == null) return;
            const condition = new PgCondition(queryBuilder);
            return condition;
          });
        },
        orderBy(parent, $connection, value) {
          const $select = $connection.getSubplan();
          value.apply($select);
        }
      }
    },
    integrations: {
      plan($record) {
        const $records = pgResource_integrationPgResource.find({
          user_id: $record.get("id")
        });
        return connection($records);
      },
      args: {
        first(_, $connection, arg) {
          $connection.setFirst(arg.getRaw());
        },
        last(_, $connection, val) {
          $connection.setLast(val.getRaw());
        },
        offset(_, $connection, val) {
          $connection.setOffset(val.getRaw());
        },
        before(_, $connection, val) {
          $connection.setBefore(val.getRaw());
        },
        after(_, $connection, val) {
          $connection.setAfter(val.getRaw());
        },
        condition(_condition, $connection, arg) {
          const $select = $connection.getSubplan();
          arg.apply($select, qbWhereBuilder);
        },
        filter(_, $connection, fieldArg) {
          const $pgSelect = $connection.getSubplan();
          fieldArg.apply($pgSelect, (queryBuilder, value) => {
            assertAllowed5(value, "object");
            if (value == null) return;
            const condition = new PgCondition(queryBuilder);
            return condition;
          });
        },
        orderBy(parent, $connection, value) {
          const $select = $connection.getSubplan();
          value.apply($select);
        }
      }
    }
  },
  UUID: {
    serialize: UUIDSerialize,
    parseValue(value) {
      return coerce("" + value);
    },
    parseLiteral(ast) {
      if (ast.kind !== Kind.STRING) throw new GraphQLError(`${"UUID" ?? "This scalar"} can only parse string values (kind = '${ast.kind}')`);
      return coerce(ast.value);
    }
  },
  Datetime: {
    serialize: UUIDSerialize,
    parseValue: UUIDSerialize,
    parseLiteral(ast) {
      if (ast.kind !== Kind.STRING) throw new GraphQLError(`${"Datetime" ?? "This scalar"} can only parse string values (kind='${ast.kind}')`);
      return ast.value;
    }
  },
  WorkflowConnection: {
    __assertStep: ConnectionStep,
    totalCount($connection) {
      return $connection.cloneSubplanWithoutPagination("aggregate").singleAsRecord().select(sql`count(*)`, TYPES.bigint, !1);
    }
  },
  Workflow: {
    __assertStep: assertPgClassSingleStep,
    id($parent) {
      const specifier = nodeIdHandlerByTypeName.Workflow.plan($parent);
      return lambda(specifier, nodeIdCodecs[nodeIdHandlerByTypeName.Workflow.codec.name].encode);
    },
    rowId($record) {
      return $record.get("id");
    },
    isActive($record) {
      return $record.get("is_active");
    },
    userId($record) {
      return $record.get("user_id");
    },
    createdAt($record) {
      return $record.get("created_at");
    },
    updatedAt($record) {
      return $record.get("updated_at");
    },
    user($record) {
      return pgResource_userPgResource.get({
        id: $record.get("user_id")
      });
    }
  },
  JSON: {
    serialize(value) {
      return value;
    },
    parseValue(value) {
      return value;
    },
    parseLiteral: (() => {
      const parseLiteralToObject = (ast, variables) => {
        switch (ast.kind) {
          case Kind.STRING:
          case Kind.BOOLEAN:
            return ast.value;
          case Kind.INT:
          case Kind.FLOAT:
            return parseFloat(ast.value);
          case Kind.OBJECT:
            {
              const value = Object.create(null);
              ast.fields.forEach(field => {
                value[field.name.value] = parseLiteralToObject(field.value, variables);
              });
              return value;
            }
          case Kind.LIST:
            return ast.values.map(n => parseLiteralToObject(n, variables));
          case Kind.NULL:
            return null;
          case Kind.VARIABLE:
            {
              const name = ast.name.value;
              return variables ? variables[name] : void 0;
            }
          default:
            return;
        }
      };
      return parseLiteralToObject;
    })()
  },
  WorkflowEdge: {
    __assertStep: assertEdgeCapableStep,
    cursor($edge) {
      return $edge.cursor();
    },
    node($edge) {
      return $edge.node();
    }
  },
  Cursor: {
    serialize: UUIDSerialize,
    parseValue: UUIDSerialize,
    parseLiteral(ast) {
      if (ast.kind !== Kind.STRING) throw new GraphQLError(`${"Cursor" ?? "This scalar"} can only parse string values (kind='${ast.kind}')`);
      return ast.value;
    }
  },
  PageInfo: {
    __assertStep: assertPageInfoCapableStep,
    hasNextPage($pageInfo) {
      return $pageInfo.hasNextPage();
    },
    hasPreviousPage($pageInfo) {
      return $pageInfo.hasPreviousPage();
    },
    startCursor($pageInfo) {
      return $pageInfo.startCursor();
    },
    endCursor($pageInfo) {
      return $pageInfo.endCursor();
    }
  },
  WorkflowCondition: {
    rowId($condition, val) {
      $condition.where({
        type: "attribute",
        attribute: "id",
        callback(expression) {
          return val === null ? sql`${expression} is null` : sql`${expression} = ${sqlValueWithCodec(val, TYPES.uuid)}`;
        }
      });
    },
    isActive($condition, val) {
      $condition.where({
        type: "attribute",
        attribute: "is_active",
        callback(expression) {
          return val === null ? sql`${expression} is null` : sql`${expression} = ${sqlValueWithCodec(val, TYPES.boolean)}`;
        }
      });
    },
    userId($condition, val) {
      $condition.where({
        type: "attribute",
        attribute: "user_id",
        callback(expression) {
          return val === null ? sql`${expression} is null` : sql`${expression} = ${sqlValueWithCodec(val, TYPES.uuid)}`;
        }
      });
    }
  },
  WorkflowFilter: {
    rowId(queryBuilder, value) {
      if (value === void 0) return;
      if (!false && isEmpty(value)) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const condition = new PgCondition(queryBuilder);
      condition.extensions.pgFilterAttribute = colSpec;
      return condition;
    },
    isActive(queryBuilder, value) {
      if (value === void 0) return;
      if (!false && isEmpty(value)) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const condition = new PgCondition(queryBuilder);
      condition.extensions.pgFilterAttribute = colSpec2;
      return condition;
    },
    userId(queryBuilder, value) {
      if (value === void 0) return;
      if (!false && isEmpty(value)) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const condition = new PgCondition(queryBuilder);
      condition.extensions.pgFilterAttribute = colSpec3;
      return condition;
    },
    user($where, value) {
      assertAllowed6(value, "object");
      if (value == null) return;
      const $subQuery = $where.existsPlan({
        tableExpression: userIdentifier,
        alias: pgResource_userPgResource.name
      });
      registryConfig.pgRelations.workflow.userByMyUserId.localAttributes.forEach((localAttribute, i) => {
        const remoteAttribute = registryConfig.pgRelations.workflow.userByMyUserId.remoteAttributes[i];
        $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
      });
      return $subQuery;
    },
    and($where, value) {
      assertAllowed7(value, "list");
      if (value == null) return;
      return $where.andPlan();
    },
    or($where, value) {
      assertAllowed7(value, "list");
      if (value == null) return;
      const $or = $where.orPlan();
      return () => $or.andPlan();
    },
    not($where, value) {
      assertAllowed7(value, "object");
      if (value == null) return;
      return $where.notPlan().andPlan();
    }
  },
  UUIDFilter: {
    isNull($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec ? resolveInputCodec(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = resolveSqlValue ? resolveSqlValue($where, value, inputCodec) : sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "isNull"
        });
      $where.where(fragment);
    },
    equalTo($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier ? resolveSqlIdentifier(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec2 ? resolveInputCodec2(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve2(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "equalTo"
        });
      $where.where(fragment);
    },
    notEqualTo($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier ? resolveSqlIdentifier(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec2 ? resolveInputCodec2(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve3(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "notEqualTo"
        });
      $where.where(fragment);
    },
    distinctFrom($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier ? resolveSqlIdentifier(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec2 ? resolveInputCodec2(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve4(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "distinctFrom"
        });
      $where.where(fragment);
    },
    notDistinctFrom($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier ? resolveSqlIdentifier(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec2 ? resolveInputCodec2(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve5(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "notDistinctFrom"
        });
      $where.where(fragment);
    },
    in($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier ? resolveSqlIdentifier(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec3 ? resolveInputCodec3(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve6(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "in"
        });
      $where.where(fragment);
    },
    notIn($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier ? resolveSqlIdentifier(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec3 ? resolveInputCodec3(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve7(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "notIn"
        });
      $where.where(fragment);
    },
    lessThan($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier ? resolveSqlIdentifier(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec2 ? resolveInputCodec2(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve8(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "lessThan"
        });
      $where.where(fragment);
    },
    lessThanOrEqualTo($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier ? resolveSqlIdentifier(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec2 ? resolveInputCodec2(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve9(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "lessThanOrEqualTo"
        });
      $where.where(fragment);
    },
    greaterThan($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier ? resolveSqlIdentifier(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec2 ? resolveInputCodec2(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve10(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "greaterThan"
        });
      $where.where(fragment);
    },
    greaterThanOrEqualTo($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier ? resolveSqlIdentifier(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec2 ? resolveInputCodec2(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve11(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "greaterThanOrEqualTo"
        });
      $where.where(fragment);
    }
  },
  BooleanFilter: {
    isNull($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec4 ? resolveInputCodec4(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = resolveSqlValue2 ? resolveSqlValue2($where, value, inputCodec) : sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve12(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "isNull"
        });
      $where.where(fragment);
    },
    equalTo($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier2 ? resolveSqlIdentifier2(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec5 ? resolveInputCodec5(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve13(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "equalTo"
        });
      $where.where(fragment);
    },
    notEqualTo($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier2 ? resolveSqlIdentifier2(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec5 ? resolveInputCodec5(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve14(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "notEqualTo"
        });
      $where.where(fragment);
    },
    distinctFrom($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier2 ? resolveSqlIdentifier2(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec5 ? resolveInputCodec5(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve15(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "distinctFrom"
        });
      $where.where(fragment);
    },
    notDistinctFrom($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier2 ? resolveSqlIdentifier2(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec5 ? resolveInputCodec5(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve16(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "notDistinctFrom"
        });
      $where.where(fragment);
    },
    in($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier2 ? resolveSqlIdentifier2(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec6 ? resolveInputCodec6(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve17(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "in"
        });
      $where.where(fragment);
    },
    notIn($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier2 ? resolveSqlIdentifier2(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec6 ? resolveInputCodec6(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve18(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "notIn"
        });
      $where.where(fragment);
    },
    lessThan($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier2 ? resolveSqlIdentifier2(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec5 ? resolveInputCodec5(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve19(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "lessThan"
        });
      $where.where(fragment);
    },
    lessThanOrEqualTo($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier2 ? resolveSqlIdentifier2(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec5 ? resolveInputCodec5(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve20(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "lessThanOrEqualTo"
        });
      $where.where(fragment);
    },
    greaterThan($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier2 ? resolveSqlIdentifier2(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec5 ? resolveInputCodec5(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve21(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "greaterThan"
        });
      $where.where(fragment);
    },
    greaterThanOrEqualTo($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier2 ? resolveSqlIdentifier2(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec5 ? resolveInputCodec5(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve22(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "greaterThanOrEqualTo"
        });
      $where.where(fragment);
    }
  },
  UserFilter: {
    rowId(queryBuilder, value) {
      if (value === void 0) return;
      if (!false && isEmpty(value)) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const condition = new PgCondition(queryBuilder);
      condition.extensions.pgFilterAttribute = colSpec4;
      return condition;
    },
    identityProviderId(queryBuilder, value) {
      if (value === void 0) return;
      if (!false && isEmpty(value)) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const condition = new PgCondition(queryBuilder);
      condition.extensions.pgFilterAttribute = colSpec5;
      return condition;
    },
    email(queryBuilder, value) {
      if (value === void 0) return;
      if (!false && isEmpty(value)) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const condition = new PgCondition(queryBuilder);
      condition.extensions.pgFilterAttribute = colSpec6;
      return condition;
    },
    workflows($where, value) {
      assertAllowed8(value, "object");
      const $rel = $where.andPlan();
      $rel.extensions.pgFilterRelation = {
        tableExpression: workflowIdentifier,
        alias: pgResource_workflowPgResource.name,
        localAttributes: registryConfig.pgRelations.user.workflowsByTheirUserId.localAttributes,
        remoteAttributes: registryConfig.pgRelations.user.workflowsByTheirUserId.remoteAttributes
      };
      return $rel;
    },
    workflowsExist($where, value) {
      assertAllowed8(value, "scalar");
      if (value == null) return;
      const $subQuery = $where.existsPlan({
        tableExpression: workflowIdentifier,
        alias: pgResource_workflowPgResource.name,
        equals: value
      });
      registryConfig.pgRelations.user.workflowsByTheirUserId.localAttributes.forEach((localAttribute, i) => {
        const remoteAttribute = registryConfig.pgRelations.user.workflowsByTheirUserId.remoteAttributes[i];
        $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
      });
    },
    integrations($where, value) {
      assertAllowed8(value, "object");
      const $rel = $where.andPlan();
      $rel.extensions.pgFilterRelation = {
        tableExpression: integrationIdentifier,
        alias: pgResource_integrationPgResource.name,
        localAttributes: registryConfig.pgRelations.user.integrationsByTheirUserId.localAttributes,
        remoteAttributes: registryConfig.pgRelations.user.integrationsByTheirUserId.remoteAttributes
      };
      return $rel;
    },
    integrationsExist($where, value) {
      assertAllowed8(value, "scalar");
      if (value == null) return;
      const $subQuery = $where.existsPlan({
        tableExpression: integrationIdentifier,
        alias: pgResource_integrationPgResource.name,
        equals: value
      });
      registryConfig.pgRelations.user.integrationsByTheirUserId.localAttributes.forEach((localAttribute, i) => {
        const remoteAttribute = registryConfig.pgRelations.user.integrationsByTheirUserId.remoteAttributes[i];
        $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
      });
    },
    and($where, value) {
      assertAllowed9(value, "list");
      if (value == null) return;
      return $where.andPlan();
    },
    or($where, value) {
      assertAllowed9(value, "list");
      if (value == null) return;
      const $or = $where.orPlan();
      return () => $or.andPlan();
    },
    not($where, value) {
      assertAllowed9(value, "object");
      if (value == null) return;
      return $where.notPlan().andPlan();
    }
  },
  StringFilter: {
    isNull($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec7 ? resolveInputCodec7(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = resolveSqlValue3 ? resolveSqlValue3($where, value, inputCodec) : sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve23(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "isNull"
        });
      $where.where(fragment);
    },
    equalTo($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier3 ? resolveSqlIdentifier3(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec8 ? resolveInputCodec8(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve24(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "equalTo"
        });
      $where.where(fragment);
    },
    notEqualTo($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier3 ? resolveSqlIdentifier3(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec8 ? resolveInputCodec8(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve25(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "notEqualTo"
        });
      $where.where(fragment);
    },
    distinctFrom($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier3 ? resolveSqlIdentifier3(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec8 ? resolveInputCodec8(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve26(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "distinctFrom"
        });
      $where.where(fragment);
    },
    notDistinctFrom($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier3 ? resolveSqlIdentifier3(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec8 ? resolveInputCodec8(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve27(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "notDistinctFrom"
        });
      $where.where(fragment);
    },
    in($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier3 ? resolveSqlIdentifier3(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec9 ? resolveInputCodec9(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve28(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "in"
        });
      $where.where(fragment);
    },
    notIn($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier3 ? resolveSqlIdentifier3(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec9 ? resolveInputCodec9(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve29(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "notIn"
        });
      $where.where(fragment);
    },
    lessThan($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier3 ? resolveSqlIdentifier3(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec8 ? resolveInputCodec8(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve30(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "lessThan"
        });
      $where.where(fragment);
    },
    lessThanOrEqualTo($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier3 ? resolveSqlIdentifier3(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec8 ? resolveInputCodec8(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve31(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "lessThanOrEqualTo"
        });
      $where.where(fragment);
    },
    greaterThan($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier3 ? resolveSqlIdentifier3(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec8 ? resolveInputCodec8(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve32(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "greaterThan"
        });
      $where.where(fragment);
    },
    greaterThanOrEqualTo($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier3 ? resolveSqlIdentifier3(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec8 ? resolveInputCodec8(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve33(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "greaterThanOrEqualTo"
        });
      $where.where(fragment);
    },
    includes($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier3 ? resolveSqlIdentifier3(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = resolveInput ? resolveInput(value) : value,
        inputCodec = resolveInputCodec8 ? resolveInputCodec8(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve34(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "includes"
        });
      $where.where(fragment);
    },
    notIncludes($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier3 ? resolveSqlIdentifier3(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = resolveInput2 ? resolveInput2(value) : value,
        inputCodec = resolveInputCodec8 ? resolveInputCodec8(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve35(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "notIncludes"
        });
      $where.where(fragment);
    },
    includesInsensitive($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier4 ? resolveSqlIdentifier4(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = resolveInput3 ? resolveInput3(value) : value,
        inputCodec = resolveInputCodec10 ? resolveInputCodec10(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve36(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "includesInsensitive"
        });
      $where.where(fragment);
    },
    notIncludesInsensitive($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier4 ? resolveSqlIdentifier4(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = resolveInput4 ? resolveInput4(value) : value,
        inputCodec = resolveInputCodec10 ? resolveInputCodec10(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve37(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "notIncludesInsensitive"
        });
      $where.where(fragment);
    },
    startsWith($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier3 ? resolveSqlIdentifier3(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = resolveInput5 ? resolveInput5(value) : value,
        inputCodec = resolveInputCodec8 ? resolveInputCodec8(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve38(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "startsWith"
        });
      $where.where(fragment);
    },
    notStartsWith($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier3 ? resolveSqlIdentifier3(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = resolveInput6 ? resolveInput6(value) : value,
        inputCodec = resolveInputCodec8 ? resolveInputCodec8(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve39(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "notStartsWith"
        });
      $where.where(fragment);
    },
    startsWithInsensitive($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier4 ? resolveSqlIdentifier4(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = resolveInput7 ? resolveInput7(value) : value,
        inputCodec = resolveInputCodec10 ? resolveInputCodec10(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve40(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "startsWithInsensitive"
        });
      $where.where(fragment);
    },
    notStartsWithInsensitive($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier4 ? resolveSqlIdentifier4(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = resolveInput8 ? resolveInput8(value) : value,
        inputCodec = resolveInputCodec10 ? resolveInputCodec10(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve41(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "notStartsWithInsensitive"
        });
      $where.where(fragment);
    },
    endsWith($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier3 ? resolveSqlIdentifier3(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = resolveInput9 ? resolveInput9(value) : value,
        inputCodec = resolveInputCodec8 ? resolveInputCodec8(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve42(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "endsWith"
        });
      $where.where(fragment);
    },
    notEndsWith($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier3 ? resolveSqlIdentifier3(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = resolveInput10 ? resolveInput10(value) : value,
        inputCodec = resolveInputCodec8 ? resolveInputCodec8(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve43(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "notEndsWith"
        });
      $where.where(fragment);
    },
    endsWithInsensitive($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier4 ? resolveSqlIdentifier4(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = resolveInput11 ? resolveInput11(value) : value,
        inputCodec = resolveInputCodec10 ? resolveInputCodec10(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve44(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "endsWithInsensitive"
        });
      $where.where(fragment);
    },
    notEndsWithInsensitive($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier4 ? resolveSqlIdentifier4(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = resolveInput12 ? resolveInput12(value) : value,
        inputCodec = resolveInputCodec10 ? resolveInputCodec10(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve45(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "notEndsWithInsensitive"
        });
      $where.where(fragment);
    },
    like($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier3 ? resolveSqlIdentifier3(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec8 ? resolveInputCodec8(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve46(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "like"
        });
      $where.where(fragment);
    },
    notLike($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier3 ? resolveSqlIdentifier3(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec8 ? resolveInputCodec8(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve47(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "notLike"
        });
      $where.where(fragment);
    },
    likeInsensitive($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier4 ? resolveSqlIdentifier4(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec10 ? resolveInputCodec10(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve48(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "likeInsensitive"
        });
      $where.where(fragment);
    },
    notLikeInsensitive($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier4 ? resolveSqlIdentifier4(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec10 ? resolveInputCodec10(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve49(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "notLikeInsensitive"
        });
      $where.where(fragment);
    },
    equalToInsensitive($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier5 ? resolveSqlIdentifier5(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec11 ? resolveInputCodec11(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = resolveSqlValue4 ? resolveSqlValue4($where, value, inputCodec) : sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve24(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "equalToInsensitive"
        });
      $where.where(fragment);
    },
    notEqualToInsensitive($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier6 ? resolveSqlIdentifier6(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec12 ? resolveInputCodec12(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = resolveSqlValue5 ? resolveSqlValue5($where, value, inputCodec) : sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve25(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "notEqualToInsensitive"
        });
      $where.where(fragment);
    },
    distinctFromInsensitive($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier7 ? resolveSqlIdentifier7(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec13 ? resolveInputCodec13(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = resolveSqlValue6 ? resolveSqlValue6($where, value, inputCodec) : sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve26(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "distinctFromInsensitive"
        });
      $where.where(fragment);
    },
    notDistinctFromInsensitive($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier8 ? resolveSqlIdentifier8(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec14 ? resolveInputCodec14(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = resolveSqlValue7 ? resolveSqlValue7($where, value, inputCodec) : sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve27(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "notDistinctFromInsensitive"
        });
      $where.where(fragment);
    },
    inInsensitive($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier9 ? resolveSqlIdentifier9(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec15 ? resolveInputCodec15(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = resolveSqlValue8 ? resolveSqlValue8($where, value, inputCodec) : sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve28(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "inInsensitive"
        });
      $where.where(fragment);
    },
    notInInsensitive($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier10 ? resolveSqlIdentifier10(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec16 ? resolveInputCodec16(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = resolveSqlValue9 ? resolveSqlValue9($where, value, inputCodec) : sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve29(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "notInInsensitive"
        });
      $where.where(fragment);
    },
    lessThanInsensitive($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier11 ? resolveSqlIdentifier11(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec17 ? resolveInputCodec17(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = resolveSqlValue10 ? resolveSqlValue10($where, value, inputCodec) : sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve30(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "lessThanInsensitive"
        });
      $where.where(fragment);
    },
    lessThanOrEqualToInsensitive($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier12 ? resolveSqlIdentifier12(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec18 ? resolveInputCodec18(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = resolveSqlValue11 ? resolveSqlValue11($where, value, inputCodec) : sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve31(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "lessThanOrEqualToInsensitive"
        });
      $where.where(fragment);
    },
    greaterThanInsensitive($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier13 ? resolveSqlIdentifier13(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec19 ? resolveInputCodec19(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = resolveSqlValue12 ? resolveSqlValue12($where, value, inputCodec) : sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve32(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "greaterThanInsensitive"
        });
      $where.where(fragment);
    },
    greaterThanOrEqualToInsensitive($where, value) {
      if (!$where.extensions?.pgFilterAttribute) throw Error("Planning error: expected 'pgFilterAttribute' to be present on the $where plan's extensions; your extensions to `postgraphile-plugin-connection-filter` does not implement the required interfaces.");
      if (value === void 0) return;
      const {
          fieldName: parentFieldName,
          attributeName,
          attribute,
          codec,
          expression
        } = $where.extensions.pgFilterAttribute,
        sourceAlias = attribute ? attribute.expression ? attribute.expression($where.alias) : sql`${$where.alias}.${sql.identifier(attributeName)}` : expression ? expression : $where.alias,
        sourceCodec = codec ?? attribute.codec,
        [sqlIdentifier, identifierCodec] = resolveSqlIdentifier14 ? resolveSqlIdentifier14(sourceAlias, sourceCodec) : [sourceAlias, sourceCodec];
      if (false && value === null) return;
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const resolvedInput = value,
        inputCodec = resolveInputCodec20 ? resolveInputCodec20(codec ?? attribute.codec) : codec ?? attribute.codec,
        sqlValue = resolveSqlValue13 ? resolveSqlValue13($where, value, inputCodec) : sqlValueWithCodec(resolvedInput, inputCodec),
        fragment = resolve33(sqlIdentifier, sqlValue, value, $where, {
          fieldName: parentFieldName ?? null,
          operatorName: "greaterThanOrEqualToInsensitive"
        });
      $where.where(fragment);
    }
  },
  UserToManyWorkflowFilter: {
    every($where, value) {
      assertAllowed10(value, "object");
      if (value == null) return;
      if (!$where.extensions.pgFilterRelation) throw Error("Invalid use of filter, 'pgFilterRelation' expected");
      const {
          localAttributes,
          remoteAttributes,
          tableExpression,
          alias
        } = $where.extensions.pgFilterRelation,
        $subQuery = $where.notPlan().existsPlan({
          tableExpression,
          alias
        });
      localAttributes.forEach((localAttribute, i) => {
        const remoteAttribute = remoteAttributes[i];
        $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
      });
      return $subQuery.notPlan().andPlan();
    },
    some($where, value) {
      assertAllowed10(value, "object");
      if (value == null) return;
      if (!$where.extensions.pgFilterRelation) throw Error("Invalid use of filter, 'pgFilterRelation' expected");
      const {
          localAttributes,
          remoteAttributes,
          tableExpression,
          alias
        } = $where.extensions.pgFilterRelation,
        $subQuery = $where.existsPlan({
          tableExpression,
          alias
        });
      localAttributes.forEach((localAttribute, i) => {
        const remoteAttribute = remoteAttributes[i];
        $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
      });
      return $subQuery;
    },
    none($where, value) {
      assertAllowed10(value, "object");
      if (value == null) return;
      if (!$where.extensions.pgFilterRelation) throw Error("Invalid use of filter, 'pgFilterRelation' expected");
      const {
          localAttributes,
          remoteAttributes,
          tableExpression,
          alias
        } = $where.extensions.pgFilterRelation,
        $subQuery = $where.notPlan().existsPlan({
          tableExpression,
          alias
        });
      localAttributes.forEach((localAttribute, i) => {
        const remoteAttribute = remoteAttributes[i];
        $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
      });
      return $subQuery;
    }
  },
  UserToManyIntegrationFilter: {
    every($where, value) {
      assertAllowed11(value, "object");
      if (value == null) return;
      if (!$where.extensions.pgFilterRelation) throw Error("Invalid use of filter, 'pgFilterRelation' expected");
      const {
          localAttributes,
          remoteAttributes,
          tableExpression,
          alias
        } = $where.extensions.pgFilterRelation,
        $subQuery = $where.notPlan().existsPlan({
          tableExpression,
          alias
        });
      localAttributes.forEach((localAttribute, i) => {
        const remoteAttribute = remoteAttributes[i];
        $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
      });
      return $subQuery.notPlan().andPlan();
    },
    some($where, value) {
      assertAllowed11(value, "object");
      if (value == null) return;
      if (!$where.extensions.pgFilterRelation) throw Error("Invalid use of filter, 'pgFilterRelation' expected");
      const {
          localAttributes,
          remoteAttributes,
          tableExpression,
          alias
        } = $where.extensions.pgFilterRelation,
        $subQuery = $where.existsPlan({
          tableExpression,
          alias
        });
      localAttributes.forEach((localAttribute, i) => {
        const remoteAttribute = remoteAttributes[i];
        $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
      });
      return $subQuery;
    },
    none($where, value) {
      assertAllowed11(value, "object");
      if (value == null) return;
      if (!$where.extensions.pgFilterRelation) throw Error("Invalid use of filter, 'pgFilterRelation' expected");
      const {
          localAttributes,
          remoteAttributes,
          tableExpression,
          alias
        } = $where.extensions.pgFilterRelation,
        $subQuery = $where.notPlan().existsPlan({
          tableExpression,
          alias
        });
      localAttributes.forEach((localAttribute, i) => {
        const remoteAttribute = remoteAttributes[i];
        $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
      });
      return $subQuery;
    }
  },
  IntegrationFilter: {
    rowId(queryBuilder, value) {
      if (value === void 0) return;
      if (!false && isEmpty(value)) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const condition = new PgCondition(queryBuilder);
      condition.extensions.pgFilterAttribute = colSpec7;
      return condition;
    },
    type(queryBuilder, value) {
      if (value === void 0) return;
      if (!false && isEmpty(value)) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const condition = new PgCondition(queryBuilder);
      condition.extensions.pgFilterAttribute = colSpec8;
      return condition;
    },
    userId(queryBuilder, value) {
      if (value === void 0) return;
      if (!false && isEmpty(value)) throw Object.assign(Error("Empty objects are forbidden in filter argument input."), {});
      if (!false && value === null) throw Object.assign(Error("Null literals are forbidden in filter argument input."), {});
      const condition = new PgCondition(queryBuilder);
      condition.extensions.pgFilterAttribute = colSpec9;
      return condition;
    },
    user($where, value) {
      assertAllowed12(value, "object");
      if (value == null) return;
      const $subQuery = $where.existsPlan({
        tableExpression: userIdentifier,
        alias: pgResource_userPgResource.name
      });
      registryConfig.pgRelations.integration.userByMyUserId.localAttributes.forEach((localAttribute, i) => {
        const remoteAttribute = registryConfig.pgRelations.integration.userByMyUserId.remoteAttributes[i];
        $subQuery.where(sql`${$where.alias}.${sql.identifier(localAttribute)} = ${$subQuery.alias}.${sql.identifier(remoteAttribute)}`);
      });
      return $subQuery;
    },
    and($where, value) {
      assertAllowed13(value, "list");
      if (value == null) return;
      return $where.andPlan();
    },
    or($where, value) {
      assertAllowed13(value, "list");
      if (value == null) return;
      const $or = $where.orPlan();
      return () => $or.andPlan();
    },
    not($where, value) {
      assertAllowed13(value, "object");
      if (value == null) return;
      return $where.notPlan().andPlan();
    }
  },
  WorkflowOrderBy: {
    PRIMARY_KEY_ASC(queryBuilder) {
      workflowUniques[0].attributes.forEach(attributeName => {
        queryBuilder.orderBy({
          attribute: attributeName,
          direction: "ASC"
        });
      });
      queryBuilder.setOrderIsUnique();
    },
    PRIMARY_KEY_DESC(queryBuilder) {
      workflowUniques[0].attributes.forEach(attributeName => {
        queryBuilder.orderBy({
          attribute: attributeName,
          direction: "DESC"
        });
      });
      queryBuilder.setOrderIsUnique();
    },
    ROW_ID_ASC(queryBuilder) {
      queryBuilder.orderBy({
        attribute: "id",
        direction: "ASC"
      });
      queryBuilder.setOrderIsUnique();
    },
    ROW_ID_DESC(queryBuilder) {
      queryBuilder.orderBy({
        attribute: "id",
        direction: "DESC"
      });
      queryBuilder.setOrderIsUnique();
    },
    IS_ACTIVE_ASC(queryBuilder) {
      queryBuilder.orderBy({
        attribute: "is_active",
        direction: "ASC"
      });
    },
    IS_ACTIVE_DESC(queryBuilder) {
      queryBuilder.orderBy({
        attribute: "is_active",
        direction: "DESC"
      });
    },
    USER_ID_ASC(queryBuilder) {
      queryBuilder.orderBy({
        attribute: "user_id",
        direction: "ASC"
      });
    },
    USER_ID_DESC(queryBuilder) {
      queryBuilder.orderBy({
        attribute: "user_id",
        direction: "DESC"
      });
    }
  },
  IntegrationConnection: {
    __assertStep: ConnectionStep,
    totalCount($connection) {
      return $connection.cloneSubplanWithoutPagination("aggregate").singleAsRecord().select(sql`count(*)`, TYPES.bigint, !1);
    }
  },
  Integration: {
    __assertStep: assertPgClassSingleStep,
    id($parent) {
      const specifier = nodeIdHandlerByTypeName.Integration.plan($parent);
      return lambda(specifier, nodeIdCodecs[nodeIdHandlerByTypeName.Integration.codec.name].encode);
    },
    rowId($record) {
      return $record.get("id");
    },
    isEnabled($record) {
      return $record.get("is_enabled");
    },
    userId($record) {
      return $record.get("user_id");
    },
    createdAt($record) {
      return $record.get("created_at");
    },
    updatedAt($record) {
      return $record.get("updated_at");
    },
    user($record) {
      return pgResource_userPgResource.get({
        id: $record.get("user_id")
      });
    }
  },
  IntegrationEdge: {
    __assertStep: assertEdgeCapableStep,
    cursor($edge) {
      return $edge.cursor();
    },
    node($edge) {
      return $edge.node();
    }
  },
  IntegrationCondition: {
    rowId($condition, val) {
      $condition.where({
        type: "attribute",
        attribute: "id",
        callback(expression) {
          return val === null ? sql`${expression} is null` : sql`${expression} = ${sqlValueWithCodec(val, TYPES.uuid)}`;
        }
      });
    },
    type($condition, val) {
      $condition.where({
        type: "attribute",
        attribute: "type",
        callback(expression) {
          return val === null ? sql`${expression} is null` : sql`${expression} = ${sqlValueWithCodec(val, TYPES.text)}`;
        }
      });
    },
    userId($condition, val) {
      $condition.where({
        type: "attribute",
        attribute: "user_id",
        callback(expression) {
          return val === null ? sql`${expression} is null` : sql`${expression} = ${sqlValueWithCodec(val, TYPES.uuid)}`;
        }
      });
    }
  },
  IntegrationOrderBy: {
    PRIMARY_KEY_ASC(queryBuilder) {
      integrationUniques[0].attributes.forEach(attributeName => {
        queryBuilder.orderBy({
          attribute: attributeName,
          direction: "ASC"
        });
      });
      queryBuilder.setOrderIsUnique();
    },
    PRIMARY_KEY_DESC(queryBuilder) {
      integrationUniques[0].attributes.forEach(attributeName => {
        queryBuilder.orderBy({
          attribute: attributeName,
          direction: "DESC"
        });
      });
      queryBuilder.setOrderIsUnique();
    },
    ROW_ID_ASC(queryBuilder) {
      queryBuilder.orderBy({
        attribute: "id",
        direction: "ASC"
      });
      queryBuilder.setOrderIsUnique();
    },
    ROW_ID_DESC(queryBuilder) {
      queryBuilder.orderBy({
        attribute: "id",
        direction: "DESC"
      });
      queryBuilder.setOrderIsUnique();
    },
    TYPE_ASC(queryBuilder) {
      queryBuilder.orderBy({
        attribute: "type",
        direction: "ASC"
      });
    },
    TYPE_DESC(queryBuilder) {
      queryBuilder.orderBy({
        attribute: "type",
        direction: "DESC"
      });
    },
    USER_ID_ASC(queryBuilder) {
      queryBuilder.orderBy({
        attribute: "user_id",
        direction: "ASC"
      });
    },
    USER_ID_DESC(queryBuilder) {
      queryBuilder.orderBy({
        attribute: "user_id",
        direction: "DESC"
      });
    }
  },
  UserConnection: {
    __assertStep: ConnectionStep,
    totalCount($connection) {
      return $connection.cloneSubplanWithoutPagination("aggregate").singleAsRecord().select(sql`count(*)`, TYPES.bigint, !1);
    }
  },
  UserEdge: {
    __assertStep: assertEdgeCapableStep,
    cursor($edge) {
      return $edge.cursor();
    },
    node($edge) {
      return $edge.node();
    }
  },
  UserCondition: {
    rowId($condition, val) {
      $condition.where({
        type: "attribute",
        attribute: "id",
        callback(expression) {
          return val === null ? sql`${expression} is null` : sql`${expression} = ${sqlValueWithCodec(val, TYPES.uuid)}`;
        }
      });
    },
    identityProviderId($condition, val) {
      $condition.where({
        type: "attribute",
        attribute: "identity_provider_id",
        callback(expression) {
          return val === null ? sql`${expression} is null` : sql`${expression} = ${sqlValueWithCodec(val, TYPES.uuid)}`;
        }
      });
    },
    email($condition, val) {
      $condition.where({
        type: "attribute",
        attribute: "email",
        callback(expression) {
          return val === null ? sql`${expression} is null` : sql`${expression} = ${sqlValueWithCodec(val, TYPES.text)}`;
        }
      });
    }
  },
  UserOrderBy: {
    PRIMARY_KEY_ASC(queryBuilder) {
      userUniques[0].attributes.forEach(attributeName => {
        queryBuilder.orderBy({
          attribute: attributeName,
          direction: "ASC"
        });
      });
      queryBuilder.setOrderIsUnique();
    },
    PRIMARY_KEY_DESC(queryBuilder) {
      userUniques[0].attributes.forEach(attributeName => {
        queryBuilder.orderBy({
          attribute: attributeName,
          direction: "DESC"
        });
      });
      queryBuilder.setOrderIsUnique();
    },
    ROW_ID_ASC(queryBuilder) {
      queryBuilder.orderBy({
        attribute: "id",
        direction: "ASC"
      });
      queryBuilder.setOrderIsUnique();
    },
    ROW_ID_DESC(queryBuilder) {
      queryBuilder.orderBy({
        attribute: "id",
        direction: "DESC"
      });
      queryBuilder.setOrderIsUnique();
    },
    IDENTITY_PROVIDER_ID_ASC(queryBuilder) {
      queryBuilder.orderBy({
        attribute: "identity_provider_id",
        direction: "ASC"
      });
      queryBuilder.setOrderIsUnique();
    },
    IDENTITY_PROVIDER_ID_DESC(queryBuilder) {
      queryBuilder.orderBy({
        attribute: "identity_provider_id",
        direction: "DESC"
      });
      queryBuilder.setOrderIsUnique();
    },
    EMAIL_ASC(queryBuilder) {
      queryBuilder.orderBy({
        attribute: "email",
        direction: "ASC"
      });
      queryBuilder.setOrderIsUnique();
    },
    EMAIL_DESC(queryBuilder) {
      queryBuilder.orderBy({
        attribute: "email",
        direction: "DESC"
      });
      queryBuilder.setOrderIsUnique();
    }
  },
  Mutation: {
    __assertStep: __ValueStep,
    createUser: {
      plan(_, args) {
        const $insert = pgInsertSingle(pgResource_userPgResource, Object.create(null));
        args.apply($insert);
        return object({
          result: $insert
        });
      },
      args: {
        input(_, $object) {
          return $object;
        }
      }
    },
    createIntegration: {
      plan(_, args) {
        const $insert = pgInsertSingle(pgResource_integrationPgResource, Object.create(null));
        args.apply($insert);
        return object({
          result: $insert
        });
      },
      args: {
        input(_, $object) {
          return $object;
        }
      }
    },
    createWorkflow: {
      plan(_, args) {
        const $insert = pgInsertSingle(pgResource_workflowPgResource, Object.create(null));
        args.apply($insert);
        return object({
          result: $insert
        });
      },
      args: {
        input(_, $object) {
          return $object;
        }
      }
    },
    updateUserById: {
      plan(_$root, args) {
        const $update = pgUpdateSingle(pgResource_userPgResource, specFromArgs_User(args));
        args.apply($update);
        return object({
          result: $update
        });
      },
      args: {
        input(_, $object) {
          return $object;
        }
      }
    },
    updateUser: {
      plan(_$root, args) {
        const $update = pgUpdateSingle(pgResource_userPgResource, {
          id: args.getRaw(['input', "rowId"])
        });
        args.apply($update);
        return object({
          result: $update
        });
      },
      args: {
        input(_, $object) {
          return $object;
        }
      }
    },
    updateUserByEmail: {
      plan(_$root, args) {
        const $update = pgUpdateSingle(pgResource_userPgResource, {
          email: args.getRaw(['input', "email"])
        });
        args.apply($update);
        return object({
          result: $update
        });
      },
      args: {
        input(_, $object) {
          return $object;
        }
      }
    },
    updateUserByIdentityProviderId: {
      plan(_$root, args) {
        const $update = pgUpdateSingle(pgResource_userPgResource, {
          identity_provider_id: args.getRaw(['input', "identityProviderId"])
        });
        args.apply($update);
        return object({
          result: $update
        });
      },
      args: {
        input(_, $object) {
          return $object;
        }
      }
    },
    updateIntegrationById: {
      plan(_$root, args) {
        const $update = pgUpdateSingle(pgResource_integrationPgResource, specFromArgs_Integration(args));
        args.apply($update);
        return object({
          result: $update
        });
      },
      args: {
        input(_, $object) {
          return $object;
        }
      }
    },
    updateIntegration: {
      plan(_$root, args) {
        const $update = pgUpdateSingle(pgResource_integrationPgResource, {
          id: args.getRaw(['input', "rowId"])
        });
        args.apply($update);
        return object({
          result: $update
        });
      },
      args: {
        input(_, $object) {
          return $object;
        }
      }
    },
    updateWorkflowById: {
      plan(_$root, args) {
        const $update = pgUpdateSingle(pgResource_workflowPgResource, specFromArgs_Workflow(args));
        args.apply($update);
        return object({
          result: $update
        });
      },
      args: {
        input(_, $object) {
          return $object;
        }
      }
    },
    updateWorkflow: {
      plan(_$root, args) {
        const $update = pgUpdateSingle(pgResource_workflowPgResource, {
          id: args.getRaw(['input', "rowId"])
        });
        args.apply($update);
        return object({
          result: $update
        });
      },
      args: {
        input(_, $object) {
          return $object;
        }
      }
    },
    deleteUserById: {
      plan(_$root, args) {
        const $delete = pgDeleteSingle(pgResource_userPgResource, specFromArgs_User2(args));
        args.apply($delete);
        return object({
          result: $delete
        });
      },
      args: {
        input(_, $object) {
          return $object;
        }
      }
    },
    deleteUser: {
      plan(_$root, args) {
        const $delete = pgDeleteSingle(pgResource_userPgResource, {
          id: args.getRaw(['input', "rowId"])
        });
        args.apply($delete);
        return object({
          result: $delete
        });
      },
      args: {
        input(_, $object) {
          return $object;
        }
      }
    },
    deleteUserByEmail: {
      plan(_$root, args) {
        const $delete = pgDeleteSingle(pgResource_userPgResource, {
          email: args.getRaw(['input', "email"])
        });
        args.apply($delete);
        return object({
          result: $delete
        });
      },
      args: {
        input(_, $object) {
          return $object;
        }
      }
    },
    deleteUserByIdentityProviderId: {
      plan(_$root, args) {
        const $delete = pgDeleteSingle(pgResource_userPgResource, {
          identity_provider_id: args.getRaw(['input', "identityProviderId"])
        });
        args.apply($delete);
        return object({
          result: $delete
        });
      },
      args: {
        input(_, $object) {
          return $object;
        }
      }
    },
    deleteIntegrationById: {
      plan(_$root, args) {
        const $delete = pgDeleteSingle(pgResource_integrationPgResource, specFromArgs_Integration2(args));
        args.apply($delete);
        return object({
          result: $delete
        });
      },
      args: {
        input(_, $object) {
          return $object;
        }
      }
    },
    deleteIntegration: {
      plan(_$root, args) {
        const $delete = pgDeleteSingle(pgResource_integrationPgResource, {
          id: args.getRaw(['input', "rowId"])
        });
        args.apply($delete);
        return object({
          result: $delete
        });
      },
      args: {
        input(_, $object) {
          return $object;
        }
      }
    },
    deleteWorkflowById: {
      plan(_$root, args) {
        const $delete = pgDeleteSingle(pgResource_workflowPgResource, specFromArgs_Workflow2(args));
        args.apply($delete);
        return object({
          result: $delete
        });
      },
      args: {
        input(_, $object) {
          return $object;
        }
      }
    },
    deleteWorkflow: {
      plan(_$root, args) {
        const $delete = pgDeleteSingle(pgResource_workflowPgResource, {
          id: args.getRaw(['input', "rowId"])
        });
        args.apply($delete);
        return object({
          result: $delete
        });
      },
      args: {
        input(_, $object) {
          return $object;
        }
      }
    }
  },
  CreateUserPayload: {
    __assertStep: assertExecutableStep,
    clientMutationId($mutation) {
      return $mutation.getStepForKey("result").getMeta("clientMutationId");
    },
    user($object) {
      return $object.get("result");
    },
    query() {
      return rootValue();
    },
    userEdge($mutation, fieldArgs) {
      const $result = $mutation.getStepForKey("result", !0);
      if (!$result) return constant(null);
      const $select = (() => {
        if ($result instanceof PgDeleteSingleStep) return pgSelectFromRecord($result.resource, $result.record());else {
          const spec = userUniques[0].attributes.reduce((memo, attributeName) => {
            memo[attributeName] = $result.get(attributeName);
            return memo;
          }, Object.create(null));
          return pgResource_userPgResource.find(spec);
        }
      })();
      fieldArgs.apply($select, "orderBy");
      const $connection = connection($select),
        $single = $select.row(first($select));
      return new EdgeStep($connection, $single);
    }
  },
  CreateUserInput: {
    clientMutationId(qb, val) {
      qb.setMeta("clientMutationId", val);
    },
    user(qb, arg) {
      if (arg != null) return qb.setBuilder();
    }
  },
  UserInput: {
    __baked: createObjectAndApplyChildren,
    rowId(obj, val, {
      field,
      schema
    }) {
      obj.set("id", bakedInputRuntime(schema, field.type, val));
    },
    identityProviderId(obj, val, {
      field,
      schema
    }) {
      obj.set("identity_provider_id", bakedInputRuntime(schema, field.type, val));
    },
    createdAt(obj, val, {
      field,
      schema
    }) {
      obj.set("created_at", bakedInputRuntime(schema, field.type, val));
    },
    updatedAt(obj, val, {
      field,
      schema
    }) {
      obj.set("updated_at", bakedInputRuntime(schema, field.type, val));
    },
    email(obj, val, {
      field,
      schema
    }) {
      obj.set("email", bakedInputRuntime(schema, field.type, val));
    },
    name(obj, val, {
      field,
      schema
    }) {
      obj.set("name", bakedInputRuntime(schema, field.type, val));
    },
    avatar(obj, val, {
      field,
      schema
    }) {
      obj.set("avatar", bakedInputRuntime(schema, field.type, val));
    },
    isOnboarded(obj, val, {
      field,
      schema
    }) {
      obj.set("is_onboarded", bakedInputRuntime(schema, field.type, val));
    },
    theme(obj, val, {
      field,
      schema
    }) {
      obj.set("theme", bakedInputRuntime(schema, field.type, val));
    },
    planType(obj, val, {
      field,
      schema
    }) {
      obj.set("plan_type", bakedInputRuntime(schema, field.type, val));
    }
  },
  CreateIntegrationPayload: {
    __assertStep: assertExecutableStep,
    clientMutationId($mutation) {
      return $mutation.getStepForKey("result").getMeta("clientMutationId");
    },
    integration($object) {
      return $object.get("result");
    },
    query() {
      return rootValue();
    },
    integrationEdge($mutation, fieldArgs) {
      const $result = $mutation.getStepForKey("result", !0);
      if (!$result) return constant(null);
      const $select = (() => {
        if ($result instanceof PgDeleteSingleStep) return pgSelectFromRecord($result.resource, $result.record());else {
          const spec = integrationUniques[0].attributes.reduce((memo, attributeName) => {
            memo[attributeName] = $result.get(attributeName);
            return memo;
          }, Object.create(null));
          return pgResource_integrationPgResource.find(spec);
        }
      })();
      fieldArgs.apply($select, "orderBy");
      const $connection = connection($select),
        $single = $select.row(first($select));
      return new EdgeStep($connection, $single);
    }
  },
  CreateIntegrationInput: {
    clientMutationId(qb, val) {
      qb.setMeta("clientMutationId", val);
    },
    integration(qb, arg) {
      if (arg != null) return qb.setBuilder();
    }
  },
  IntegrationInput: {
    __baked: createObjectAndApplyChildren,
    rowId(obj, val, {
      field,
      schema
    }) {
      obj.set("id", bakedInputRuntime(schema, field.type, val));
    },
    type(obj, val, {
      field,
      schema
    }) {
      obj.set("type", bakedInputRuntime(schema, field.type, val));
    },
    name(obj, val, {
      field,
      schema
    }) {
      obj.set("name", bakedInputRuntime(schema, field.type, val));
    },
    isEnabled(obj, val, {
      field,
      schema
    }) {
      obj.set("is_enabled", bakedInputRuntime(schema, field.type, val));
    },
    config(obj, val, {
      field,
      schema
    }) {
      obj.set("config", bakedInputRuntime(schema, field.type, val));
    },
    userId(obj, val, {
      field,
      schema
    }) {
      obj.set("user_id", bakedInputRuntime(schema, field.type, val));
    },
    createdAt(obj, val, {
      field,
      schema
    }) {
      obj.set("created_at", bakedInputRuntime(schema, field.type, val));
    },
    updatedAt(obj, val, {
      field,
      schema
    }) {
      obj.set("updated_at", bakedInputRuntime(schema, field.type, val));
    }
  },
  CreateWorkflowPayload: {
    __assertStep: assertExecutableStep,
    clientMutationId($mutation) {
      return $mutation.getStepForKey("result").getMeta("clientMutationId");
    },
    workflow($object) {
      return $object.get("result");
    },
    query() {
      return rootValue();
    },
    workflowEdge($mutation, fieldArgs) {
      const $result = $mutation.getStepForKey("result", !0);
      if (!$result) return constant(null);
      const $select = (() => {
        if ($result instanceof PgDeleteSingleStep) return pgSelectFromRecord($result.resource, $result.record());else {
          const spec = workflowUniques[0].attributes.reduce((memo, attributeName) => {
            memo[attributeName] = $result.get(attributeName);
            return memo;
          }, Object.create(null));
          return pgResource_workflowPgResource.find(spec);
        }
      })();
      fieldArgs.apply($select, "orderBy");
      const $connection = connection($select),
        $single = $select.row(first($select));
      return new EdgeStep($connection, $single);
    }
  },
  CreateWorkflowInput: {
    clientMutationId(qb, val) {
      qb.setMeta("clientMutationId", val);
    },
    workflow(qb, arg) {
      if (arg != null) return qb.setBuilder();
    }
  },
  WorkflowInput: {
    __baked: createObjectAndApplyChildren,
    rowId(obj, val, {
      field,
      schema
    }) {
      obj.set("id", bakedInputRuntime(schema, field.type, val));
    },
    name(obj, val, {
      field,
      schema
    }) {
      obj.set("name", bakedInputRuntime(schema, field.type, val));
    },
    description(obj, val, {
      field,
      schema
    }) {
      obj.set("description", bakedInputRuntime(schema, field.type, val));
    },
    definition(obj, val, {
      field,
      schema
    }) {
      obj.set("definition", bakedInputRuntime(schema, field.type, val));
    },
    isActive(obj, val, {
      field,
      schema
    }) {
      obj.set("is_active", bakedInputRuntime(schema, field.type, val));
    },
    userId(obj, val, {
      field,
      schema
    }) {
      obj.set("user_id", bakedInputRuntime(schema, field.type, val));
    },
    createdAt(obj, val, {
      field,
      schema
    }) {
      obj.set("created_at", bakedInputRuntime(schema, field.type, val));
    },
    updatedAt(obj, val, {
      field,
      schema
    }) {
      obj.set("updated_at", bakedInputRuntime(schema, field.type, val));
    }
  },
  UpdateUserPayload: {
    __assertStep: ObjectStep,
    clientMutationId($mutation) {
      return $mutation.getStepForKey("result").getMeta("clientMutationId");
    },
    user($object) {
      return $object.get("result");
    },
    query() {
      return rootValue();
    },
    userEdge($mutation, fieldArgs) {
      const $result = $mutation.getStepForKey("result", !0);
      if (!$result) return constant(null);
      const $select = (() => {
        if ($result instanceof PgDeleteSingleStep) return pgSelectFromRecord($result.resource, $result.record());else {
          const spec = userUniques[0].attributes.reduce((memo, attributeName) => {
            memo[attributeName] = $result.get(attributeName);
            return memo;
          }, Object.create(null));
          return pgResource_userPgResource.find(spec);
        }
      })();
      fieldArgs.apply($select, "orderBy");
      const $connection = connection($select),
        $single = $select.row(first($select));
      return new EdgeStep($connection, $single);
    }
  },
  UpdateUserByIdInput: {
    clientMutationId(qb, val) {
      qb.setMeta("clientMutationId", val);
    },
    patch(qb, arg) {
      if (arg != null) return qb.setBuilder();
    }
  },
  UserPatch: {
    __baked: createObjectAndApplyChildren,
    rowId(obj, val, {
      field,
      schema
    }) {
      obj.set("id", bakedInputRuntime(schema, field.type, val));
    },
    identityProviderId(obj, val, {
      field,
      schema
    }) {
      obj.set("identity_provider_id", bakedInputRuntime(schema, field.type, val));
    },
    createdAt(obj, val, {
      field,
      schema
    }) {
      obj.set("created_at", bakedInputRuntime(schema, field.type, val));
    },
    updatedAt(obj, val, {
      field,
      schema
    }) {
      obj.set("updated_at", bakedInputRuntime(schema, field.type, val));
    },
    email(obj, val, {
      field,
      schema
    }) {
      obj.set("email", bakedInputRuntime(schema, field.type, val));
    },
    name(obj, val, {
      field,
      schema
    }) {
      obj.set("name", bakedInputRuntime(schema, field.type, val));
    },
    avatar(obj, val, {
      field,
      schema
    }) {
      obj.set("avatar", bakedInputRuntime(schema, field.type, val));
    },
    isOnboarded(obj, val, {
      field,
      schema
    }) {
      obj.set("is_onboarded", bakedInputRuntime(schema, field.type, val));
    },
    theme(obj, val, {
      field,
      schema
    }) {
      obj.set("theme", bakedInputRuntime(schema, field.type, val));
    },
    planType(obj, val, {
      field,
      schema
    }) {
      obj.set("plan_type", bakedInputRuntime(schema, field.type, val));
    }
  },
  UpdateUserInput: {
    clientMutationId(qb, val) {
      qb.setMeta("clientMutationId", val);
    },
    patch(qb, arg) {
      if (arg != null) return qb.setBuilder();
    }
  },
  UpdateUserByEmailInput: {
    clientMutationId(qb, val) {
      qb.setMeta("clientMutationId", val);
    },
    patch(qb, arg) {
      if (arg != null) return qb.setBuilder();
    }
  },
  UpdateUserByIdentityProviderIdInput: {
    clientMutationId(qb, val) {
      qb.setMeta("clientMutationId", val);
    },
    patch(qb, arg) {
      if (arg != null) return qb.setBuilder();
    }
  },
  UpdateIntegrationPayload: {
    __assertStep: ObjectStep,
    clientMutationId($mutation) {
      return $mutation.getStepForKey("result").getMeta("clientMutationId");
    },
    integration($object) {
      return $object.get("result");
    },
    query() {
      return rootValue();
    },
    integrationEdge($mutation, fieldArgs) {
      const $result = $mutation.getStepForKey("result", !0);
      if (!$result) return constant(null);
      const $select = (() => {
        if ($result instanceof PgDeleteSingleStep) return pgSelectFromRecord($result.resource, $result.record());else {
          const spec = integrationUniques[0].attributes.reduce((memo, attributeName) => {
            memo[attributeName] = $result.get(attributeName);
            return memo;
          }, Object.create(null));
          return pgResource_integrationPgResource.find(spec);
        }
      })();
      fieldArgs.apply($select, "orderBy");
      const $connection = connection($select),
        $single = $select.row(first($select));
      return new EdgeStep($connection, $single);
    }
  },
  UpdateIntegrationByIdInput: {
    clientMutationId(qb, val) {
      qb.setMeta("clientMutationId", val);
    },
    patch(qb, arg) {
      if (arg != null) return qb.setBuilder();
    }
  },
  IntegrationPatch: {
    __baked: createObjectAndApplyChildren,
    rowId(obj, val, {
      field,
      schema
    }) {
      obj.set("id", bakedInputRuntime(schema, field.type, val));
    },
    type(obj, val, {
      field,
      schema
    }) {
      obj.set("type", bakedInputRuntime(schema, field.type, val));
    },
    name(obj, val, {
      field,
      schema
    }) {
      obj.set("name", bakedInputRuntime(schema, field.type, val));
    },
    isEnabled(obj, val, {
      field,
      schema
    }) {
      obj.set("is_enabled", bakedInputRuntime(schema, field.type, val));
    },
    config(obj, val, {
      field,
      schema
    }) {
      obj.set("config", bakedInputRuntime(schema, field.type, val));
    },
    userId(obj, val, {
      field,
      schema
    }) {
      obj.set("user_id", bakedInputRuntime(schema, field.type, val));
    },
    createdAt(obj, val, {
      field,
      schema
    }) {
      obj.set("created_at", bakedInputRuntime(schema, field.type, val));
    },
    updatedAt(obj, val, {
      field,
      schema
    }) {
      obj.set("updated_at", bakedInputRuntime(schema, field.type, val));
    }
  },
  UpdateIntegrationInput: {
    clientMutationId(qb, val) {
      qb.setMeta("clientMutationId", val);
    },
    patch(qb, arg) {
      if (arg != null) return qb.setBuilder();
    }
  },
  UpdateWorkflowPayload: {
    __assertStep: ObjectStep,
    clientMutationId($mutation) {
      return $mutation.getStepForKey("result").getMeta("clientMutationId");
    },
    workflow($object) {
      return $object.get("result");
    },
    query() {
      return rootValue();
    },
    workflowEdge($mutation, fieldArgs) {
      const $result = $mutation.getStepForKey("result", !0);
      if (!$result) return constant(null);
      const $select = (() => {
        if ($result instanceof PgDeleteSingleStep) return pgSelectFromRecord($result.resource, $result.record());else {
          const spec = workflowUniques[0].attributes.reduce((memo, attributeName) => {
            memo[attributeName] = $result.get(attributeName);
            return memo;
          }, Object.create(null));
          return pgResource_workflowPgResource.find(spec);
        }
      })();
      fieldArgs.apply($select, "orderBy");
      const $connection = connection($select),
        $single = $select.row(first($select));
      return new EdgeStep($connection, $single);
    }
  },
  UpdateWorkflowByIdInput: {
    clientMutationId(qb, val) {
      qb.setMeta("clientMutationId", val);
    },
    patch(qb, arg) {
      if (arg != null) return qb.setBuilder();
    }
  },
  WorkflowPatch: {
    __baked: createObjectAndApplyChildren,
    rowId(obj, val, {
      field,
      schema
    }) {
      obj.set("id", bakedInputRuntime(schema, field.type, val));
    },
    name(obj, val, {
      field,
      schema
    }) {
      obj.set("name", bakedInputRuntime(schema, field.type, val));
    },
    description(obj, val, {
      field,
      schema
    }) {
      obj.set("description", bakedInputRuntime(schema, field.type, val));
    },
    definition(obj, val, {
      field,
      schema
    }) {
      obj.set("definition", bakedInputRuntime(schema, field.type, val));
    },
    isActive(obj, val, {
      field,
      schema
    }) {
      obj.set("is_active", bakedInputRuntime(schema, field.type, val));
    },
    userId(obj, val, {
      field,
      schema
    }) {
      obj.set("user_id", bakedInputRuntime(schema, field.type, val));
    },
    createdAt(obj, val, {
      field,
      schema
    }) {
      obj.set("created_at", bakedInputRuntime(schema, field.type, val));
    },
    updatedAt(obj, val, {
      field,
      schema
    }) {
      obj.set("updated_at", bakedInputRuntime(schema, field.type, val));
    }
  },
  UpdateWorkflowInput: {
    clientMutationId(qb, val) {
      qb.setMeta("clientMutationId", val);
    },
    patch(qb, arg) {
      if (arg != null) return qb.setBuilder();
    }
  },
  DeleteUserPayload: {
    __assertStep: ObjectStep,
    clientMutationId($mutation) {
      return $mutation.getStepForKey("result").getMeta("clientMutationId");
    },
    user($object) {
      return $object.get("result");
    },
    deletedUserId($object) {
      const $record = $object.getStepForKey("result"),
        specifier = nodeIdHandlerByTypeName.User.plan($record);
      return lambda(specifier, nodeIdCodecs_base64JSON_base64JSON.encode);
    },
    query() {
      return rootValue();
    },
    userEdge($mutation, fieldArgs) {
      const $result = $mutation.getStepForKey("result", !0);
      if (!$result) return constant(null);
      const $select = (() => {
        if ($result instanceof PgDeleteSingleStep) return pgSelectFromRecord($result.resource, $result.record());else {
          const spec = userUniques[0].attributes.reduce((memo, attributeName) => {
            memo[attributeName] = $result.get(attributeName);
            return memo;
          }, Object.create(null));
          return pgResource_userPgResource.find(spec);
        }
      })();
      fieldArgs.apply($select, "orderBy");
      const $connection = connection($select),
        $single = $select.row(first($select));
      return new EdgeStep($connection, $single);
    }
  },
  DeleteUserByIdInput: {
    clientMutationId(qb, val) {
      qb.setMeta("clientMutationId", val);
    }
  },
  DeleteUserInput: {
    clientMutationId(qb, val) {
      qb.setMeta("clientMutationId", val);
    }
  },
  DeleteUserByEmailInput: {
    clientMutationId(qb, val) {
      qb.setMeta("clientMutationId", val);
    }
  },
  DeleteUserByIdentityProviderIdInput: {
    clientMutationId(qb, val) {
      qb.setMeta("clientMutationId", val);
    }
  },
  DeleteIntegrationPayload: {
    __assertStep: ObjectStep,
    clientMutationId($mutation) {
      return $mutation.getStepForKey("result").getMeta("clientMutationId");
    },
    integration($object) {
      return $object.get("result");
    },
    deletedIntegrationId($object) {
      const $record = $object.getStepForKey("result"),
        specifier = nodeIdHandlerByTypeName.Integration.plan($record);
      return lambda(specifier, nodeIdCodecs_base64JSON_base64JSON.encode);
    },
    query() {
      return rootValue();
    },
    integrationEdge($mutation, fieldArgs) {
      const $result = $mutation.getStepForKey("result", !0);
      if (!$result) return constant(null);
      const $select = (() => {
        if ($result instanceof PgDeleteSingleStep) return pgSelectFromRecord($result.resource, $result.record());else {
          const spec = integrationUniques[0].attributes.reduce((memo, attributeName) => {
            memo[attributeName] = $result.get(attributeName);
            return memo;
          }, Object.create(null));
          return pgResource_integrationPgResource.find(spec);
        }
      })();
      fieldArgs.apply($select, "orderBy");
      const $connection = connection($select),
        $single = $select.row(first($select));
      return new EdgeStep($connection, $single);
    }
  },
  DeleteIntegrationByIdInput: {
    clientMutationId(qb, val) {
      qb.setMeta("clientMutationId", val);
    }
  },
  DeleteIntegrationInput: {
    clientMutationId(qb, val) {
      qb.setMeta("clientMutationId", val);
    }
  },
  DeleteWorkflowPayload: {
    __assertStep: ObjectStep,
    clientMutationId($mutation) {
      return $mutation.getStepForKey("result").getMeta("clientMutationId");
    },
    workflow($object) {
      return $object.get("result");
    },
    deletedWorkflowId($object) {
      const $record = $object.getStepForKey("result"),
        specifier = nodeIdHandlerByTypeName.Workflow.plan($record);
      return lambda(specifier, nodeIdCodecs_base64JSON_base64JSON.encode);
    },
    query() {
      return rootValue();
    },
    workflowEdge($mutation, fieldArgs) {
      const $result = $mutation.getStepForKey("result", !0);
      if (!$result) return constant(null);
      const $select = (() => {
        if ($result instanceof PgDeleteSingleStep) return pgSelectFromRecord($result.resource, $result.record());else {
          const spec = workflowUniques[0].attributes.reduce((memo, attributeName) => {
            memo[attributeName] = $result.get(attributeName);
            return memo;
          }, Object.create(null));
          return pgResource_workflowPgResource.find(spec);
        }
      })();
      fieldArgs.apply($select, "orderBy");
      const $connection = connection($select),
        $single = $select.row(first($select));
      return new EdgeStep($connection, $single);
    }
  },
  DeleteWorkflowByIdInput: {
    clientMutationId(qb, val) {
      qb.setMeta("clientMutationId", val);
    }
  },
  DeleteWorkflowInput: {
    clientMutationId(qb, val) {
      qb.setMeta("clientMutationId", val);
    }
  }
};
export const schema = makeGrafastSchema({
  typeDefs: typeDefs,
  plans: plans
});