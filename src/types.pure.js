import { mapWithState } from './util.pure';

/**
 * Based on: https://github.com/puffnfresh/roy/blob/master/src/types.js
 */

export const TYPE_VARIABLE = 'TypeVariable';
export const FUNCTION_TYPE = 'FunctionType';
export const PRIMITIVE_TYPE = 'PrimitiveType';
export const ARRAY_TYPE = 'ArrayType';
export const OBJECT_TYPE = 'ObjectType';

export const INITIAL_TYPE_VARIABLES_STATE = {
    nextId: 0,
    variables: {},
};

// ## Type variable

// A type variable represents an parameter with an unknown type or any
// polymorphic type. For example:

//     id = x => x

// Here, `id` has the polymorphic type `#a -> #a`.

export function createTypeVariable(typeVariables, { idString } = {}) {
    console.assert(typeVariables && typeof typeVariables.nextId === 'number');

    const nextNextId = idString ? typeVariables.nextId : typeVariables.nextId + 1;
    const id = idString ? variableFromString(idString) : typeVariables.nextId;
    const variable = {
        type: TYPE_VARIABLE,
        id,
        toString() {
            return "#" + variableToString(id);
        }
    };
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
export function createFunctionType(types, typeClasses = []) {
    return {
        type: FUNCTION_TYPE,
        types,
        typeClasses,
        toString() {
            return types.join(' -> ');
        }
    };
}

// FunctionType.prototype.fresh = function(nonGeneric, mappings) {
//     if(!mappings) mappings = {};

//     var newTypeClasses = _.map(this.typeClasses, function(typeClass) {
//         return typeClass.fresh(nonGeneric, mappings);
//     });

//     return new FunctionType(_.map(this.types, function(t) {
//         return t.fresh(nonGeneric, mappings);
//     }), newTypeClasses);
// };
// FunctionType.prototype.toString = function() {
//     return this.name + "(" + _.map(this.types, function(type) {
//         return type.toString();
//     }).join(', ') + ")";
// };


// // ### Fresh type
// //
// // Getting a "fresh" type will create a recursive copy. When a generic type
// // variable is encountered, a new variable is generated and substituted in.
// //
// // A fresh type is only returned when an identifier is found during analysis.
// // See `analyse` for some context.
// function fresh(nonGeneric, mappings) {
//     if(!mappings) mappings = {};

//     var type = prune(this);
//     if(!(type instanceof Variable)) {
//         return type.fresh(nonGeneric, mappings);
//     }

//     if(occursInTypeArray(type, nonGeneric)) {
//         return type;
//     }

//     if(!mappings[type.id]) {
//         mappings[type.id] = new Variable();
//     }
//     return mappings[type.id];
// };

export function createPrimitiveType(primitiveType) {
    return {
        type: PRIMITIVE_TYPE,
        primitiveType,
        toString() {
            return primitiveType;
        }
    };
}

export const UNIT_TYPE = createPrimitiveType('Unit');
export const NUMBER_TYPE = createPrimitiveType('Number');
export const STRING_TYPE = createPrimitiveType('String');
export const BOOLEAN_TYPE = createPrimitiveType('Boolean');


export function createArrayType(elementType) {
    return {
        type: ARRAY_TYPE,
        elementType,
        toString() {
            return `[${elementType}]`;
        },
    };
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

// var ObjectType = function(props) {
//     this.props = props;
// };
// ObjectType.prototype = new BaseType();
// ObjectType.prototype.name = "Object";
// ObjectType.prototype.fresh = function(nonGeneric, mappings) {
//     var props = {};
//     var name;
//     for(name in this.props) {
//         props[name] = this.props[name].fresh(nonGeneric, mappings);
//     }
//     var freshed = new ObjectType(props);
//     if(this.aliased) freshed.aliased = this.aliased;
//     return freshed;
// };


//export function 

// var TypeClassType = function(name, type) {
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


// ### Prune
//
// This will unchain variables until it gets to a type or variable without an
// instance. See `unify` for some details about type variable instances.
export function prune(type, typeVariables) {
    console.assert(typeVariables);

    switch (type.type) {
        case TYPE_VARIABLE: {
            const pruned = typeVariables.variables[type.id];
            if ( pruned === type ) {
                return pruned;
            }
            return prune(pruned, typeVariables);
        }
        case FUNCTION_TYPE: {
            return createFunctionType(type.types.map(t => prune(t, typeVariables)));
        }
        case ARRAY_TYPE: {
            return createArrayType(prune(type.elementType));
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
            return type;
    }
    throw "prune: invalid type: " + type.type;
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
    
    if (t1.type == TYPE_VARIABLE) {
        console.assert(t2);
        if (t1 !== t2) {
            if (occursInType(t1, t2, typeVariables)) {
                throw "Recursive unification";
            }
            // t1.instance = t2;
        }
        const unified = t2.type !== TYPE_VARIABLE || t2.id < t1.id ? t2 : t1;
        return [unified, unified, {
            ...typeVariables,
            variables: {
                ...typeVariables.variables,
                [t1.id]: unified,
                [t2.id]: unified,
            },
        }];
    } else if (t2.type === TYPE_VARIABLE) {
        const [t2u, t1u, nextTypeVariables] = unify(t2, t1, typeVariables);
        return [t1u, t2u, nextTypeVariables];
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
    } else {
        console.log(t1, t2);
        throw new TypeError("Not unified: " + t1 + ' && ' + t2);
    }
}

export function occursInType(t1, t2Raw, typeVariables) {
    const t2 = prune(t2Raw, typeVariables);
    if (t2 === t1) {
        return true;
    } else if (t2.type === FUNCTION_TYPE) {
        return occursInTypeArray(t1, t2.types, typeVariables);
    }
    return false;
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
