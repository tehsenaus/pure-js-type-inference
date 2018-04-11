"use strict";

import * as babylon from 'babylon';
import traverse from 'babel-traverse';
import { prune, unify, createTypeVariable, createFunctionType, createObjectType,
	NUMBER_TYPE, STRING_TYPE, INITIAL_TYPE_VARIABLES_STATE, UNIT_TYPE, OBJECT_TYPE, BOOLEAN_TYPE } from './types.pure';
import { mapWithState, reduceWithState, mapWithStateTakeLast } from './util.pure';
import { WeakSet } from 'core-js';

function analyseFunction(node, state) {
	const outerScope = state.env;
	const recursive = !!node.id;
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
		node.body, argTypes, resultTypeVar, functionType, stateWithScope
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

export function analyseFunctionBody(body, argTypes, resultTypeVar, functionType, state) {
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

export function analyseCall(funType, args, state) {
	const { variable: resultTypeVariable, typeVariables } = createTypeVariable(state.typeVariables);
	
	const { result: argTypes, nextState } = mapWithState({
		...state, typeVariables,	
	}, args, analyse);

	const types = [
		...argTypes,
		resultTypeVariable
	];
	const callType = createFunctionType(types);

	try {
		// console.log('unifyCall: %s && %s', callType, funType)
		const [unifiedCallType, unifiedFunType, nextTypeVariables]
			= unify(callType, funType, nextState.typeVariables);
		
		const unifiedResultType = unifiedCallType.types[args.length];

		return {
			result: unifiedResultType,
			state: {
				...nextState,
				typeVariables: nextTypeVariables,
			},
		};
	} catch (e) {
		throw new TypeError('invalid call: ' + callType + ', expecting: ' + funType);
	}
}

export function analyse(node, state) {
	console.assert(state);

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
			return mapWithStateTakeLast(state, node.declarations, analyse);
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

		case 'UnaryExpression': {
			const args = [node.argument];
			const name = `${node.operator}`;

			if (!(name in state.env)) {
				throw "unknown identifier: " + name;
			}

			return analyseCall(state.env[name], args, state);
		}

		case 'BinaryExpression': {
			const args = [node.left, node.right];
			const name = `(${node.operator})`;

			if (!(name in state.env)) {
				throw "unknown identifier: " + name;
			}

			return analyseCall(state.env[name], args, state);
		}

		case 'ConditionalExpression': {
			const { result: testType, state: stateWithTest } = analyse(node.test, state);
			const [unifiedTestType, boolType, typeVariables] = unify(testType, BOOLEAN_TYPE, stateWithTest.typeVariables);

			const { result: consType, state: stateWithCons } = analyse(node.consequent, stateWithTest);
			const { result: altType, state: nextState } = analyse(node.alternate, stateWithTest);

			const [unifiedConsType, unifiedAltType, nextTypeVariables] = unify(consType, altType, nextState.typeVariables);

			return {
				result: unifiedConsType,
				state: {
					...nextState,
					typeVariables: nextTypeVariables,
				}
			};
		}

		case 'ObjectExpression': {
			const { result: types, nextState } = reduceWithState(state, node.properties, (props, p, state) => {
				switch (p.type) {
					case 'ObjectProperty': {
						const { result: type, state: nextState } = analyse(p.value, state);
						return {
							result: {
								...props,
								[p.key.name || p.key.value]: type,
							},
							state: nextState,
						};
					}

					case 'SpreadProperty': {
						const { result: type, state: nextState } = analyse(p.argument, state);

						// TODO: create intersection type, if this is a type variable
						if ( type.type !== OBJECT_TYPE ) {
							throw 'object spread of non-object type: ' + type;
						}
						
						return {
							result: {
								...props,
								...type.props,
							},
							state: nextState,
						};
					}

					default:
						throw 'unknown property type in ObjectExpression: ' + p.type;
				}	
			}, {});

			const result = createObjectType(types);

			return {
				result,
				state: {
					...nextState,
				}
			}
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
		case 'BooleanLiteral': {
			return {
				result: BOOLEAN_TYPE,
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
	'(+)': createFunctionType([ NUMBER_TYPE, NUMBER_TYPE, NUMBER_TYPE ]),
	'(-)': createFunctionType([ NUMBER_TYPE, NUMBER_TYPE, NUMBER_TYPE ]),
	'(<)': createFunctionType([ NUMBER_TYPE, NUMBER_TYPE, BOOLEAN_TYPE ]),
	'-': createFunctionType([ NUMBER_TYPE, NUMBER_TYPE ])
}
const initialState = {
	env: globalEnv,
	typeVariables: INITIAL_TYPE_VARIABLES_STATE,
}

const parseOptions = {
	plugins: ['objectRestSpread'],
};

export function analyseSource(src) {
	const wrappedSrc = `(() => { ${src} })()`;
	const ast = babylon.parse(wrappedSrc, parseOptions);
	const res = analyse(ast.program.body[0], initialState);

	console.log(prune(res.result, res.state.typeVariables).toString());

	const vars = res.state.typeVariables.variables;
	console.log(Object.keys(vars).map(k => `${k} = ${vars[k]}`).join('\n'));

	return res.result;
}

//analyseSource('return 1 + 1');
// analyseSource('1 + "a"');

// analyseSource('return function f(x, y) { return x + y; }');
analyseSource('return function fib(n) { return n < 1 ? 1 : fib(n-2) + fib(n-1) }');

// analyseSource('const f = (x, y) => x + y; return f(1, 2)');

// analyseSource('return { x: 1, y: 2, f: x => x }');
// analyseSource('return { ...{x: 1, y: 2}, f: x => x }');
// analyseSource('return s => ({ ...s, c: 1 })');

// // analyseSource('const id = x => x; id(1); return id;');
