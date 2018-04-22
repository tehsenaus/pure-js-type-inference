
import { prune, unify, createTypeVariable, createFunctionType, createObjectType, createArrayType,
    TYPE_VARIABLE, OBJECT_TYPE, setTypeVariable, addObjectProperty, createNullableType, DICT_LOOKUP_OPERATOR } from '../types.pure';


export function analyseMemberExpression(node, state, analyse) {
    console.log(node);

    const { result: lhsType, state: nextState } = analyse(node.object, state);

    const { variable: memberType, typeVariables } = createTypeVariable(nextState.typeVariables);

    if ((!node.computed && node.property.type === 'Identifier') || node.property.type === 'NumericLiteral') {
        const propName = node.property.name || node.property.value.toString();
        
        if ( lhsType.type === TYPE_VARIABLE && prune(lhsType, typeVariables).type === OBJECT_TYPE ) {
            // Performing another access on an existing object type. Either this is a new
            // property, in which case we add it to the existing type. Otherwise it's
            // an existing property, and should be unified.

            const objectType = prune(lhsType, typeVariables);

            if ( propName in objectType.props ) {
                // Existing prop
                return {
                    result: memberType,
                    state: unifyInState(memberType, objectType.props[propName], state, typeVariables),
                }
            } else {
                // New prop
                const nextObjectType = addObjectProperty(objectType, propName, memberType);
                const nextTypeVariables = setTypeVariable(
                    lhsType,
                    nextObjectType,
                    typeVariables
                );

                console.log('new prop', lhsType, objectType, nextObjectType, nextTypeVariables);

                return {
                    result: memberType,
                    state: {
                        ...nextState,
                        typeVariables: nextTypeVariables
                    }
                }
            }

        } else {
            const objectType = createObjectType({
                [propName]: memberType,
            });
    
            return {
                result: memberType,
                state: unifyInState(lhsType, objectType, state, typeVariables),
            }
        }
        
    } else {
        // Dynamic property access

        return analyse({
            ...node,
            type: 'CallExpression',
            callee: {
                ...node,
                type: 'MemberExpression',
                object: node.object,
                property: {
                    type: 'Identifier',
                    name: DICT_LOOKUP_OPERATOR,
                },
                computed: false,
            },
            arguments: [node.property],
        }, state);
    }
}

export function unifyInState(a, b, state, typeVariables = state.typeVariables) {
    const [unifiedA, unifiedB, nextTypeVariables] = unify(a, b, typeVariables);
    console.log(''+a, ''+b, ''+unifiedA, ''+unifiedB);

    return {
        ...state,
        typeVariables: nextTypeVariables,
    }
}
