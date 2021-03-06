import { identity, pick, fromPairs } from 'lodash';
import { Ajv, ValidateFunction } from 'ajv';
import AjvCtor = require('ajv');

export class ValidationError extends Error {
  public readonly name = 'ValidationError';
  constructor(message: string, public errors: any) {
    super(message);
  }
}

export interface ClassValidator {
  [method: string]: ValidateFunction;
}

function createValidator(): Ajv {
  const ajv = new AjvCtor({ useDefaults: true, allErrors: true });
  ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'));
  ajv.addKeyword('coerce-date', {
    type: 'string',
    modifying: true,
    valid: true,
    compile: (onOrOff: boolean, parentSchema: any) => {
      if (parentSchema.format !== 'date-time') {
        throw new Error('Format should be date-time when using coerce-date');
      }
      if (onOrOff !== true) {
        return identity;
      }
      return (v: any, _dataPath?: string, obj?: object | any[], key?: string | number) => {
        if (obj === undefined || key === undefined) {
          throw new Error('Cannot coerce a date at root level');
        }
        (obj as any)[key] = new Date(v);
        return true;
      };
    },
  });
  return ajv;
}

// tslint:disable:max-line-length
/**
 * Copied from https://github.com/WHenderson/json-pointer-rfc6901/blob/ca2bfd17abe37ff09394222128192023dbfb067b/src/json-pointer.coffee#L255
 */
function escapeJsonPointer(ptr: string) {
  return encodeURIComponent(ptr.replace(/~/g, '~0').replace(/\//g, '~1'));
}
// tslint:enable:max-line-length

export function createClassValidator(
  schema: { definitions: { [key: string]: any } },
  className: string,
  field: string
): ClassValidator {
  const ajv = createValidator();
  for (const [k, v] of Object.entries(schema.definitions)) {
    ajv.addSchema(v, `#/definitions/${escapeJsonPointer(k)}`);
  }
  return fromPairs(Object.entries(schema.definitions[className].properties).map(([method, s]) => [
    method, ajv.compile((s as any).properties[field]),
  ]));
}

export function createReturnTypeValidator(
  schema: { definitions: { [key: string]: any } },
  className: string
): ClassValidator {
  const ajv = createValidator();
  for (const [k, v] of Object.entries(schema.definitions)) {
    ajv.addSchema(v, `#/definitions/${escapeJsonPointer(k)}`);
  }
  return fromPairs(Object.entries(schema.definitions[className].properties).map(([method, s]) => [
    method, ajv.compile({ properties: pick((s as any).properties, 'returns') }),
  ]));
}
