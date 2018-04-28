import { INDETERMINATE_TYPE_NAME, PRIMITIVE_TYPE } from "../types.pure";

export function createPrimitiveType(primitiveType) {
    return {
        type: PRIMITIVE_TYPE,
        primitiveType,
        toString() {
            return primitiveType;
        }
    };
}

export const UNIT_TYPE = createPrimitiveType('()');
export const NUMBER_TYPE = createPrimitiveType('Number');
export const STRING_TYPE = createPrimitiveType('String');
export const BOOLEAN_TYPE = createPrimitiveType('Boolean');

/**
 * Represents the 'top' type - everything is a subtype of indeterminate.
 * 
 * Also nothing is known about it - it is completely opaque.
 */
export const INDETERMINATE_TYPE = {
    type: INDETERMINATE_TYPE_NAME,
    toString() {
        return '?';
    }
}
