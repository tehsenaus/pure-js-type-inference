
import { prune, unify, createTypeVariable, createFunctionType, createObjectType, createArrayType,
    TYPE_VARIABLE, OBJECT_TYPE, setTypeVariable, addObjectProperty } from '../types.pure';


export function analyseMemberExpression(node, state, analyse) {
    console.log(node);

    const { result: lhsType, state: nextState } = analyse(node.object, state);

    const { variable: memberType, typeVariables } = createTypeVariable(nextState.typeVariables);

    if (node.property.type === 'NumericLiteral') {
        const arrayType = createArrayType(memberType);

        return {
            result: memberType,
            state: unifyInState(lhsType, arrayType, state, typeVariables),
        }
    } else if (!node.computed && node.property.type === 'Identifier') {
        if ( lhsType.type === TYPE_VARIABLE && prune(lhsType, typeVariables).type === OBJECT_TYPE ) {
            // Performing another access on an existing object type. Either this is a new
            // property, in which case we add it to the existing type. Otherwise it's
            // an existing property, and should be unified.

            const objectType = prune(lhsType, typeVariables);
            if ( node.property.name in objectType.props ) {
                // Existing prop
                return {
                    result: memberType,
                    state: unifyInState(memberType, objectType.props[node.property.name], state, typeVariables),
                }
            } else {
                // New prop
                const nextObjectType = addObjectProperty(objectType, node.property.name, memberType);
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
                [node.property.name]: memberType,
            });
    
            return {
                result: memberType,
                state: unifyInState(lhsType, objectType, state, typeVariables),
            }
        }
        
    } else {
        throw "dynamic property access not supported!";
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
