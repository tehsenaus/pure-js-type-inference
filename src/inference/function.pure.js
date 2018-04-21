import { unify, createTypeVariable, createFunctionType, UNIT_TYPE } from '../types.pure';
import { mapWithState } from '../util.pure';

export function analyseFunction(node, state, analyse) {
	const outerScope = state.env;
	const recursive = !!node.id;
	const { result: argTypes, nextState: stateWithArgs } =
		node.params.length > 0 ? mapWithState(state, node.params, (arg, state) => {
			const { variable: result, typeVariables } = createTypeVariable(state.typeVariables);
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
		recursive ? createTypeVariable(stateWithArgs.typeVariables) : {};
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

	return {
		result,
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
