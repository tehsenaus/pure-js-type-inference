"use strict";

import { ARRAY_LOOKUP_OPERATOR, PRIMITIVE_TYPE } from "./type-constants.pure";
import { createTypeVariable } from "./type-variable.pure";
import { createFunctionType } from "./function-type.pure";
import { createObjectType } from "./object-type.pure";
import { NUMBER_TYPE, INDETERMINATE_TYPE } from "./primitive-type.pure";
import { createNullableType } from "./nullable-type.pure";
import { prune } from "../types.pure";

export function createArrayType(elementType) {
    const typeVarA = createTypeVariable(0, { bound: true });
    const typeVarB = createTypeVariable(1, { bound: true });
    return createObjectType({
        'length': NUMBER_TYPE,
        
        [ARRAY_LOOKUP_OPERATOR]: createFunctionType([
            NUMBER_TYPE,
            createNullableType(elementType || typeVarA)
        ], {
            typeVariables: elementType ? [] : [typeVarA]
        }),

        'reduce': createFunctionType([
            createFunctionType([typeVarB, typeVarA, NUMBER_TYPE, typeVarB]),
            typeVarB,
            typeVarB
        ], {
            typeVariables: [typeVarA, typeVarB]
        }),
    });
}

export function createTupleType(elementTypes, typeVariables) {
    console.assert(typeVariables);
    
    const elementType = elementTypes.length ? elementTypes.reduce((t1, t2) => commonSubtype(t1, t2, typeVariables))
        : null;
    
    return createObjectType({
        ...createArrayType(elementType).props,
        ...elementTypes.reduce((elementProps, elementType, i) => {
            return {
                ...elementProps,
                [i]: elementType
            }
        }, {})
    });
}

function commonSubtype(t1Raw, t2Raw, typeVariables) {
    console.assert(typeVariables);

    const t1 = prune(t1Raw, typeVariables);
    const t2 = prune(t2Raw, typeVariables);

    if (t1.type === PRIMITIVE_TYPE && t2.type === PRIMITIVE_TYPE && t1.primitiveType === t2.primitiveType) {
        return t1;
    }

    return INDETERMINATE_TYPE;
}
