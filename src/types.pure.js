import { mapWithState, reduceWithState } from './util.pure';

/**
 * Based on: https://github.com/puffnfresh/roy/blob/master/src/types.js
 */

export const TYPE_VARIABLE = 'TypeVariable';
export const FUNCTION_TYPE = 'FunctionType';
export const PRIMITIVE_TYPE = 'PrimitiveType';
export const ARRAY_TYPE = 'ArrayType';
export const OBJECT_TYPE = 'ObjectType';
export const NULLABLE_TYPE = 'NullableType';
export const INDETERMINATE_TYPE_NAME = 'IndeterminateType';

export const ARRAY_LOOKUP_OPERATOR = '[]';
export const DICT_LOOKUP_OPERATOR = '[]';

export const INITIAL_TYPE_VARIABLES_STATE = {
    nextId: 0,
    variables: {},
};

// ## Type variable

// A type variable represents an parameter with an unknown type or any
// polymorphic type. For example:

//     id = x => x

// Here, `id` has the polymorphic type `#a -> #a`.

export function createTypeVariable(id, { bound = false } = {}) {
    return {
        type: TYPE_VARIABLE,
        id,
        bound,
        toString() {
            return "#" + variableToString(id);
        }
    };
}

export function allocTypeVariable(typeVariables, { idString } = {}) {
    console.assert(typeVariables && typeof typeVariables.nextId === 'number');

    const nextNextId = idString ? typeVariables.nextId : typeVariables.nextId + 1;
    const id = idString ? variableFromString(idString) : typeVariables.nextId;
    const variable = createTypeVariable(id);
    return {
        variable,
        typeVariables: {
            nextId: nextNextId,
            variables: {
                ...typeVariables.variables,
                [id]: variable,
            },
        },
    };
}

const typeVariablesApplicative = {
    map: (f, fx) => typeVariables => {
        const [x, nextTypeVariables] = fx(typeVariables);
        return [f(x), nextTypeVariables];
    },
    ap: (ff, fx) => typeVariables => {
        const [f, intermedTypeVariables] = ff(typeVariables);
        const [x, nextTypeVariables] = fx(intermedTypeVariables);
        return [f(x), nextTypeVariables];
    },
    of: x => typeVariables => x,
}

export function getTypeVariable(variable, typeVariables) {
    console.assert(typeof variable.id === 'number');
    return typeVariables.variables[variable.id];
}

export function setTypeVariable(variable, value, typeVariables) {
    console.assert(typeof variable.id === 'number');
    return {
        ...typeVariables,
        variables: {
            ...typeVariables.variables,
            [variable.id]: value,
        }
    }
}

// Type variables should look like `'a`. If the variable has an instance, that
// should be used for the string instead.
//
// This is just bijective base 26.
function variableToString(n) {
    if (n >= 26) {
        return variableToString(n / 26 - 1) + toChar(n % 26);
    } else {
        return toChar(n);
    }
    
    return a + toChar(n);
}

function variableFromString(vs) {
    return _.reduce(_.map(vs.split(''), function(v, k) {
        return v.charCodeAt(0) - 'a'.charCodeAt(0) + 26 * k;
    }), function(accum, n) {
        return accum + n;
    }, 0);
}


// A `FunctionType` contains a `types` array. The last element represents the
// return type. Each element before represents an argument type.
export function createFunctionType(types, {
    // Bound type variables (local to the function)
    typeVariables = [],

    typeClasses = [],
} = {}) {
    return {
        type: FUNCTION_TYPE,
        types,
        typeVariables,
        typeClasses,
        toString() {
            const joinedTypes = types.slice(0,-1).join(',\n');
            const args = types.length === 2 && joinedTypes.indexOf(' -> ') < 0 ? '' + types[0]
                : `(${formatBlock(joinedTypes)})`;
            const typeVars = typeVariables.length ? 'forall. ' + typeVariables.join(' ') + ' => ' : '';
            return typeVars + args + ' -> ' + types[types.length - 1];
        }
    };
}

function formatBlock(str) {
    if ( str.length < 70 ) {
        return str.replace(/\n/g, ' ');
    }
    return '\n' + indent(str) + '\n';
}
function indent(str) {
    return str.split('\n').map(line => '  ' + line).join('\n');
}

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

export const INDETERMINATE_TYPE = {
    type: INDETERMINATE_TYPE_NAME,
    toString() {
        return '?';
    }
}

export function createObjectType(props) {
    return {
        type: OBJECT_TYPE,
        props,
        toString() {
            return `{${Object.keys(props).map(k => `${k}: ${props[k]}`).join(', ')}}`;
        }
    };
}

export function addObjectProperty(objectType, name, type) {
    return createObjectType({
        ...objectType.props,
        [name]: type,
    });
}

export function createArrayType(elementType) {
    const typeVarA = createTypeVariable(0, { bound: true });
    const typeVarB = createTypeVariable(1, { bound: true });
    return createObjectType({
        'length': NUMBER_TYPE,
        [ARRAY_LOOKUP_OPERATOR]: createFunctionType([NUMBER_TYPE, createNullableType(elementType)]),
        'reduce': createFunctionType([
            createFunctionType([typeVarB, typeVarA, NUMBER_TYPE, typeVarB]),
            typeVarB,
            typeVarB
        ], {
            typeVariables: [typeVarA, typeVarB]
        }),
    });
}

export function createTupleType(elementTypes, elementType = INDETERMINATE_TYPE) {
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

export function createDictType(memberType) {
    return createObjectType({
        [DICT_LOOKUP_OPERATOR]: createFunctionType([STRING_TYPE, memberType]),
    });
}

export function createNullableType(underlyingType) {
    return {
        type: NULLABLE_TYPE,
        underlyingType,
        toString() {
            return underlyingType.toString() + '?';
        }
    }
}


// function createTypeClass(name, type) {
//     this.name = name;
//     this.type = type;
//     this.types = [type];
// };
// TypeClassType.prototype = new BaseType();
// TypeClassType.prototype.fresh = function(nonGeneric, mappings) {
//     if(!mappings) mappings = {};
//     return new TypeClassType(this.name, this.type.fresh(nonGeneric, mappings));
// };
// TypeClassType.prototype.toString = function() {
//     return this.name + ' ' + this.type.toString();
// };
// exports.TypeClassType = TypeClassType;


/**
 * Creates an instance of the type with all bound type variables from functions 'instantiated'
 * to appear as type variables in the given context.
 * 
 * This is done when a function is called.
 */
export function fresh(rawType, typeVariables) {
    const type = prune(rawType, typeVariables);
    console.assert(typeVariables);

    switch (type.type) {
        case FUNCTION_TYPE: {
            const { result: freshVariableReplacements, nextState: freshTypeVariables } = reduceWithState(
                typeVariables,
                type.typeVariables,
                (replacements, variableToReplace, typeVariables) => {
                    const {
                        variable: freshVariable,
                        typeVariables: nextTypeVariables
                    } = allocTypeVariable(typeVariables);

                    // Replace bound variable with fresh instance

                    return {
                        result: {
                            ...replacements,
                            [variableToReplace.id]: freshVariable,
                        },
                        state: nextTypeVariables,
                    };
                },
                {}
            );

            console.log('fresh', ''+rawType, ''+type, freshVariableReplacements);

            const { result: freshTypes, nextState: nextTypeVariables } = mapWithState(
                freshTypeVariables,
                type.types,
                (t, typeVariables) => {
                    const replaced = replaceInType(t, freshVariableReplacements);

                    const [freshType, state] = fresh(
                        replaced,
                        typeVariables
                    );
                    return { result: freshType, state };
                }
            )

            console.log('after fresh', ''+type, freshVariableReplacements);

            return [
                createFunctionType(freshTypes),
                nextTypeVariables
            ];
        }
        case OBJECT_TYPE: {
            const { result: freshProps, nextState: nextTypeVariables } = reduceWithState(
                typeVariables,
                Object.keys(type.props),
                (props, k, typeVariables) => {
                    const prop = type.props[k];
                    const [freshProp, nextTypeVariables] = fresh(prop, typeVariables);
                    return {
                        result: freshProp === prop ? props : {
                            ...props,
                            [k]: freshProp,
                        },
                        state: nextTypeVariables,
                    };
                },
                type.props
            );
            return [
                freshProps === type.props ? type : createObjectType(freshProps),
                nextTypeVariables
            ];
        }
        case NULLABLE_TYPE: {
            const [underlyingType, nextTypeVariables] = fresh(type.underlyingType, typeVariables);
            return [createNullableType(underlyingType), nextTypeVariables];
        }
        case TYPE_VARIABLE:
        case PRIMITIVE_TYPE:
        case INDETERMINATE_TYPE_NAME:
            return [type, typeVariables];
    }
    throw new Error("fresh: invalid type: " + type.type);
}

// reduceA : (Functor F) => (r -> a -> r) -> [F a] -> F r
const reduceA = ({ map, ap, of }) => (f, init) => actions =>
    actions.reduce(
        (fr, fa, i) => ap(map(a => r => f(r, a, i), fa), fr),
        of(init)
    );

// sequenceA : (Functor F) => [F r] -> F [r]
const sequenceA = applicative => reduceA(applicative)((rs, r) => [...rs, r], []);

export const traverseType = (applicative) => (f) => {
    const {map} = applicative;
    const sequence = sequenceA(applicative);
    const reduce = reduceA(applicative);
    const traverse = (type) => {
        switch (type.type) {
            case FUNCTION_TYPE: {
                const result = sequence(type.types.map(traverse));
                return map(createFunctionType, result);
            }
            case OBJECT_TYPE: {
                const keys = Object.keys(type.props);
                const result = reduce(
                    (props, newProp, i) => {
                        const k = keys[i];
                        const prop = type.props[k];
                        return newProp === prop ? props : {
                            ...props,
                            [k]: newProp,
                        };
                    },
                    type.props
                )(
                    keys.map(k => traverse(type.props[k]))
                );

                return map(
                    replacedProps => replacedProps === type.props ? type : createObjectType(replacedProps),
                    result
                );
            }
            case TYPE_VARIABLE:
            case PRIMITIVE_TYPE:
            case INDETERMINATE_TYPE_NAME:
                return f(type);
            case NULLABLE_TYPE:
                return map(createNullableType, traverse(type.underlyingType))
        }
        throw new Error("traverseType: invalid type: " + type.type);
    };
    return traverse;
}

const identityApplicative = {
    map: (f, x) => f(x),
    ap: (f, a) => f(a),
    of: x => x,
}

const constApplicative = {
    map: (f, x) => x,
    ap: (a, b) => a.concat(b),
    of: x => [],
}

export const getAllTypeVariablesInType = traverseType(constApplicative)(type => {
    switch (type.type) {
        case TYPE_VARIABLE: {
            return type.bound ? [] : [type];
        }
    }
    return [];
});

export const replaceInType = (t, replacements) => traverseType(identityApplicative)(type => {
    switch (type.type) {
        case TYPE_VARIABLE: {
            if ( type.id in replacements ) {
                return replacements[type.id];
            }
        }
    }
    return type;
})(t);

// ### Prune
//
// This will unchain variables until it gets to a type or variable without an
// instance. See `unify` for some details about type variable instances.
export function prune(type, typeVariables) {
    console.assert(typeVariables);

    switch (type.type) {
        case TYPE_VARIABLE: {
            if ( type.bound ) {
                return type;
            }
            const pruned = typeVariables.variables[type.id];
            if ( pruned.id === type.id ) {
                return pruned;
            }
            return prune(pruned, typeVariables);
        }
        case FUNCTION_TYPE: {
            return createFunctionType(type.types.map(t => prune(t, typeVariables)), type);
        }
        case ARRAY_TYPE: {
            return createArrayType(prune(type.elementType, typeVariables));
        }
        case OBJECT_TYPE: {
            const prunedProps = Object.keys(type.props).reduce((props, k) => {
                const prop = type.props[k];
                const prunedProp = prune(prop, typeVariables);
                return prunedProp === prop ? props : {
                    ...props,
                    [k]: prunedProp,
                };
            }, type.props);
            return prunedProps === type.props ? type : createObjectType(prunedProps);
        }
        case PRIMITIVE_TYPE:
        case INDETERMINATE_TYPE_NAME:
            return type;
        case NULLABLE_TYPE:
            return createNullableType(prune(type.underlyingType, typeVariables));
    }
    throw new Error("prune: invalid type: " + type.type);
};

// ### Unification
// This is the process of finding a type that satisfies some given constraints. In this system, unification will try to satisfy that either:

// t1 and t2 are equal type variables
// t1 and t2 are equal types
// In case #1, if t1 is a type variable and t2 is not currently equal, unification will set t1 to have an instance of t2. When t1 is pruned, it will unchain to a type without an instance.

// In case #2, do a deep unification on the type, using recursion.

// If neither constraint can be met, the process will throw an error message.
export function unify(t1Raw, t2Raw, typeVariables) {
    console.assert(typeVariables);

    const t1 = prune(t1Raw, typeVariables);
    const t2 = prune(t2Raw, typeVariables);

    // console.log('unify', t1Raw, t2Raw, t1, t2, typeVariables);
    
    if (t2.type === INDETERMINATE_TYPE_NAME) {
        return [t1, t2, typeVariables];
    }

    if (t1.type === TYPE_VARIABLE) {
        console.assert(t2);

        if (t1 !== t2) {
            if (occursInType(t1, t2, typeVariables)) {
                throw "Cannot construct infinite type: " + t1 + ' ~ ' + t2;
            }
            // t1.instance = t2;
        }
        const unified = (t2.type !== TYPE_VARIABLE || t2.id < t1.id) ? t2 : t1;
        return [unified, unified, {
            ...typeVariables,
            variables: {
                ...typeVariables.variables,
                [t1.id]: unified,
                [t2.id]: unified,
            },
        }];
    } else if (t2.type === TYPE_VARIABLE) {
        if (occursInType(t2, t1, typeVariables)) {
            throw "Cannot construct infinite type: " + t1 + ' ~ ' + t2;
        }
        const unified = t1;
        return [unified, unified, {
            ...typeVariables,
            variables: {
                ...typeVariables.variables,
                [t2.id]: unified,
            },
        }];
    } else if (t1.type === FUNCTION_TYPE && t2.type === FUNCTION_TYPE) {
        if (t1.name != t2.name || t1.types.length != t2.types.length) {
            throw "Type error: " + t1.toString() + " is not " + t2.toString();
        }
        const { result: unifiedTypes, nextState: nextTypeVariables } = mapWithState(
            typeVariables,
            t1.types.slice(0, t2.types.length),
            (t, typeVariables, i) => {
                const [t1u, t2u, state] = unify(t, t2.types[i], typeVariables);
                return {
                    result: [t1u, t2u],
                    state,
                };
            }
        );

        return [
            {
                ...t1,
                types: t1.types.map((t, i) => i < unifiedTypes.length ? unifiedTypes[i][0] : t),
            }, {
                ...t2,
                types: t2.types.map((t, i) => i < unifiedTypes.length ? unifiedTypes[i][1] : t),
            },
            nextTypeVariables
        ];
    } else if (t1.type === PRIMITIVE_TYPE && t2.type === PRIMITIVE_TYPE && t1.primitiveType === t2.primitiveType) {
        return [t1, t2, typeVariables];
    } else if (t1.type === OBJECT_TYPE && t2.type === OBJECT_TYPE) {
        const t1keys = Object.keys(t1.props);
        const t2keys = Object.keys(t2.props);
        const keysSet = new Set([...t1keys, ...t2keys]);

        console.log('unify', t1, t2)

        // t1 may be a subtype of t2, in which case it may have more keys.
        if ( keysSet.size === t1keys.length ) {
            // unify every key in t2 with the corresponding t1 key.
            const { result: unifiedTypes, nextState: nextTypeVariables } = mapWithState(
                typeVariables,
                t2keys,
                (k, typeVariables, i) => {
                    const [t1u, t2u, state] = unify(t1.props[k], t2.props[k], typeVariables);
                    return {
                        result: [t1u, t2u],
                        state,
                    };
                }
            );

            return [t1, t2, nextTypeVariables];
        } else {
            const missingProps = t2keys
                .filter(k => !(k in t1.props))
                .map(k => k + ' : ' + prune(t2.props[k], typeVariables));
            throw new TypeError("Object missing properties:\n" + indent(missingProps.join('\n')));
        }
    }

    console.log(t1, t2);
    throw new TypeError("Not unified: " + t1 + ' && ' + t2);
}

export function commonSubtype(t1Raw, t2Raw, typeVariables) {
    console.assert(typeVariables);

    const t1 = prune(t1Raw, typeVariables);
    const t2 = prune(t2Raw, typeVariables);

    if (t1.type === PRIMITIVE_TYPE && t2.type === PRIMITIVE_TYPE && t1.primitiveType === t2.primitiveType) {
        return t1;
    }

    return INDETERMINATE_TYPE;
}

export function occursInType(t1, t2Raw, typeVariables) {
    const t2 = prune(t2Raw, typeVariables);
    if (t2 === t1) {
        return true;
    }
    switch (t2.type) {
        case FUNCTION_TYPE: {
            return occursInTypeArray(t1, t2.types, typeVariables);
        }
        case ARRAY_TYPE: {
            return occursInType(t1, t2.elementType, typeVariables);
        }
        case OBJECT_TYPE: {
            for ( const k in t2.props ) {
                if ( occursInType(t1, t2.props[k], typeVariables) ) {
                    return true;
                }
            }
            return false;
        }
        case NULLABLE_TYPE:
            return occursInType(t1, t2.underlyingType, typeVariables);
        case TYPE_VARIABLE:
        case PRIMITIVE_TYPE:
        case INDETERMINATE_TYPE_NAME:
            return false;
    }
    throw "occursInType: invalid type: " + t2.type;
}

export function occursInTypeArray(t1, types, typeVariables) {
    return types.some(t2 => occursInType(t1, t2, typeVariables));
}

// ### Occurs check

// These functions check whether the type `t2` is equal to or contained within
// the type `t1`. Used for checking recursive definitions in `unify` and
// checking if a variable is non-generic in `fresh`.
// export function occursInType(t1, t2) {
//     const prunedT2 = prune(t2);
//     if (prunedT2 === t1) {
//         return true;
//     } else if(t2 instanceof ObjectType) {
//         var types = [];
//         for(var prop in t2.props) {
//             types.push(t2.props[prop]);
//         }
//         return occursInTypeArray(t1, types);
//     } else if(t2 instanceof BaseType) {
//         return occursInTypeArray(t1, t2.types);
//     }
//     return false;
// };

// function occursInTypeArray(t1, types) {
//     return types.some(t2 => occursInType(t1, t2));
// };

function toChar(n) {
    return String.fromCharCode("a".charCodeAt(0) + n);
}
