import { unify, allocTypeVariable, createFunctionType, UNIT_TYPE, TYPE_VARIABLE,
    getAllTypeVariablesInType, prune, getTypeVariable, createTypeVariable, replaceInType } from '../types.pure';
import { mapWithState } from '../util.pure';

export function analyseFunction(node, state, analyse) {
    const outerScope = state.env;
    const outerTypeVariables = state.typeVariables;
	const recursive = !!node.id;
	const { result: argTypes, nextState: stateWithArgs } =
		node.params.length > 0 ? mapWithState(state, node.params, (arg, state) => {
			const { variable: result, typeVariables } = allocTypeVariable(state.typeVariables);
			// newNonGeneric.push(argType);

			return {
				result,
				state: {
					...state,
					typeVariables,

					// Define the argument in scope
					env: {
						...state.env,
						[arg.name]: result,
					},
				}
			}
		})
		: { result: [UNIT_TYPE], nextState: state };

	const { variable: resultTypeVar, typeVariables } =
		recursive ? allocTypeVariable(stateWithArgs.typeVariables) : {};
	const functionType = resultTypeVar && createFunctionType([...argTypes, resultTypeVar]);

	// For recursive calls
	const stateWithScope = recursive ? {
		...stateWithArgs,
		typeVariables,
		env: node.id ? {
			...stateWithArgs.env,
			[node.id.name]: functionType,
		} : stateWithArgs.env,
	} : stateWithArgs;

	const { result, state: nextState } = analyseFunctionBody(
		node.body, argTypes, resultTypeVar, functionType, stateWithScope, analyse
	);

	// var annotationType;
	// if(node.type) {
	// 	annotationType = nodeToType(node.type);
	// 	unify(resultType, annotationType);
    // }
    
    // Extract any bound type variables: that is, newly defined type variables which aren't
    // unified to any concrete type, or type variable in the outer scope.
    const typeVars = getAllTypeVariablesInType(result);
    const boundTypeVars = typeVars.filter(typeVar => {
        const pruned = prune(typeVar, nextState.typeVariables);
        return pruned.type === TYPE_VARIABLE && !getTypeVariable(
            pruned,
            outerTypeVariables
        );
    });
    const boundTypeVarReplacements = boundTypeVars.reduce((replacements, tv, i) => {
        return {
            ...replacements,
            [tv.id]: replacements[tv.id] || createTypeVariable(Object.keys(replacements).length, { bound: true }),
        }
    }, {});

	return {
		result: {
            ...replaceInType(result, boundTypeVarReplacements),
            typeVariables: Object.keys(boundTypeVarReplacements).map(k => boundTypeVarReplacements[k]),
        },
		state: {
			...nextState,
			env: outerScope,
		},
	};
}

export function analyseFunctionBody(body, argTypes, resultTypeVar, functionType, state, analyse) {
	const { result: resultType, state: nextState } = analyse(body, state);

	const [unifiedResultType, _unifiedResultType, nextTypeVariables] =
		resultTypeVar ? unify(resultTypeVar, resultType, nextState.typeVariables)
		: [resultType, resultType, nextState.typeVariables];
	
	return {
		result: functionType || createFunctionType([...argTypes, unifiedResultType]),
		state: {
			...nextState,
			typeVariables: nextTypeVariables,
		},
	};
}
