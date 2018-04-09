
import * as babylon from 'babylon';
import traverse from 'babel-traverse';
import { prune, unify, createTypeVariable, createFunctionType, NUMBER_TYPE, STRING_TYPE, INITIAL_TYPE_VARIABLES_STATE, UNIT_TYPE } from './types.pure';
import { mapWithState, mapWithStateTakeLast } from './util.pure';

function analyseFunction(node, state) {
	const { result: argTypes, nextState: stateWithArgs } = mapWithState(state, node.params, (arg, state) => {
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
	});

	const { result: resultType, state: nextState } = analyse(node.body, stateWithArgs);
	const types = [...argTypes, resultType];

	// var annotationType;
	// if(node.type) {
	// 	annotationType = nodeToType(node.type);
	// 	unify(resultType, annotationType);
	// }

	return {
		result: createFunctionType(types),
		state: nextState,
	};
}

export function analyseCall(funType, args, state) {
	const { variable: resultTypeVariable, typeVariables } = createTypeVariable(state.typeVariables);
	
	const { result: argTypes, nextState } = mapWithState(state, args, analyse);

	const types = [
		...argTypes,
		resultTypeVariable
	];

	const [unifiedCallType, unifiedFunType, nextTypeVariables]
		= unify(createFunctionType(types), funType, typeVariables);
	const unifiedResultType = unifiedCallType.types[args.length];

	return {
		result: unifiedResultType,
		state: {
			...nextState,
			typeVariables: nextTypeVariables,
		},
	};
}

export function analyse(node, state) {
	switch (node.type) {
		case 'ExpressionStatement': {
			return analyse(node.expression, state);
		}

		case 'FunctionExpression':
		case 'ArrowFunctionExpression': {
			return analyseFunction(node, state);
		}

		case 'FunctionDeclaration': {
			const name = node.id.name;

			const { result, state: nextState } = analyseFunction(node, state);
			
			return {
				result,
				state: {
					...nextState,
					env: {
						...state.env,
						[name]: result,
					},
				},
			};
		}

		case 'VariableDeclaration': {
			const r = mapWithStateTakeLast(state, node.declarations, analyse);
			console.log('decl', r);
			return r;
		}
		case 'VariableDeclarator': {
			const { result: type, state: nextState } = analyse(node.init, state);
			return {
				result: UNIT_TYPE,
				state: {
					...nextState,
					env: {
						...nextState.env,
						[node.id.name]: type,
					}
				}
			};
		}

		case 'CallExpression': {
			const { result: calleeType, state: nextState } = analyse(node.callee, state);
			return analyseCall(calleeType, node.arguments, nextState);
		}

		case 'BinaryExpression': {
			const args = [node.left, node.right];
			const name = `(${node.operator})`;

			return analyseCall(state.env[name], args, state);

			// return {
			// 	result: unifiedResultType,
			// 	state: {
			// 		...nextState,
			// 		env: {
			// 			...nextState.env,
			// 			[name]: unifiedFunType,
			// 		},
			// 		typeVariables: nextTypeVariables,
			// 	},
			// };
		}

		case 'ReturnStatement': {
			return analyse(node.argument, state);
		}

		case 'Identifier': {
			if ( node.name in state.env ) {
				return {
					result: state.env[node.name],
					state,
				};
			} else {
				console.error(state.env);
				throw "unknown identifier: " + node.name;
			}
		}

		case 'NumericLiteral': {
			return {
				result: NUMBER_TYPE,
				state,
			}
		}
		case 'StringLiteral': {
			return {
				result: STRING_TYPE,
				state,
			}
		}

		case 'Program':
		case 'BlockStatement': {
			const { result: bodyTypes, nextState } = mapWithState(state, node.body, analyse);

			const returnType = bodyTypes.filter((t, i) => node.body[i].type === 'ReturnStatement')[0];

			return {
				// TODO: blocks technically have void type
				result: returnType || UNIT_TYPE,
				state: nextState,
			};
		}

		default: {
			throw 'unknown AST node type: ' + node.type;
		}
	}
}

const globalEnv = {
	'(+)': createFunctionType([ NUMBER_TYPE, NUMBER_TYPE, NUMBER_TYPE ])
}
const initialState = {
	env: globalEnv,
	typeVariables: INITIAL_TYPE_VARIABLES_STATE,
}

function analyseSource(src) {
	const wrappedSrc = `(() => { ${src} })()`;
	const res = analyse(babylon.parse(wrappedSrc).program.body[0], initialState);

	console.log(res.result);

	console.log(prune(res.result, res.state.typeVariables).toString());

	const vars = res.state.typeVariables.variables;
	console.log(Object.keys(vars).map(k => `${k} = ${vars[k]}`).join('\n'));
}

analyseSource('return 1 + 1');
// analyseSource('1 + "a"');

analyseSource('return function f(x, y) { return x + y; }');

analyseSource('const f = (x, y) => x + y; return f(1, 2)');
