import { reduceWithState } from '../util.pure';
import { createObjectType, allocTypeVariable } from '../types.pure';

export function analyseObjectPattern(node, state, analyse) {
	const { result: props, nextState } = reduceWithState(state, node.properties, (props, prop, state) => {
		console.log(prop);

		const { variable: propType, typeVariables } = allocTypeVariable(state.typeVariables);

		return {
			result: {
				...props,
				[prop.key.name]: propType,
			},
			state: {
				...state,
				typeVariables,

				// Define the argument in scope
				env: {
					...state.env,
					[prop.value.name]: propType,
				},
			},
		};
	}, {});

	return {
		result: createObjectType(props),
		state: nextState,
	};
}
