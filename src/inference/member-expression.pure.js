import {
	prune,
	unify,
	allocTypeVariable,
	createFunctionType,
	createObjectType,
	createArrayType,
	TYPE_VARIABLE,
	OBJECT_TYPE,
	setTypeVariable,
	addObjectProperty,
	createNullableType,
	DICT_LOOKUP_OPERATOR,
} from '../types.pure';

export function analyseMemberExpression(node, state, analyse) {
	const { result: lhsType, state: nextState } = analyse(node.object, state);

	const { variable: memberType, typeVariables } = allocTypeVariable(nextState.typeVariables);

	const isDynamicProperty = node.computed
		&& node.property.type !== 'Identifier'
		&& node.property.type !== 'NumericLiteral';

	if (isDynamicProperty) {
		return analyse(
			{
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
			},
			state
		);
	}

	const propName = node.property.name || node.property.value.toString();

	const isExistingObjectType = lhsType.type === TYPE_VARIABLE
		&& prune(lhsType, typeVariables).type === OBJECT_TYPE;
	if (!isExistingObjectType) {
		const objectType = createObjectType({
			[propName]: memberType,
		});

		return {
			result: memberType,
			state: unifyInState(lhsType, objectType, state, typeVariables),
		};
	}

	// Performing another access on an existing object type. Either this is a new
	// property, in which case we add it to the existing type. Otherwise it's
	// an existing property, and should be unified.

	const objectType = prune(lhsType, typeVariables);

	const isExistingProp = propName in objectType.props;
	if (isExistingProp) {
		return {
			result: memberType,
			state: unifyInState(memberType, objectType.props[propName], state, typeVariables),
		};
	}

	// New prop
	const nextObjectType = addObjectProperty(objectType, propName, memberType);
	const nextTypeVariables = setTypeVariable(lhsType, nextObjectType, typeVariables);

	return {
		result: memberType,
		state: {
			...nextState,
			typeVariables: nextTypeVariables,
		},
	};
}

export function unifyInState(a, b, state, typeVariables = state.typeVariables) {
	const [unifiedA, unifiedB, nextTypeVariables] = unify(a, b, typeVariables);

	return {
		...state,
		typeVariables: nextTypeVariables,
	};
}
