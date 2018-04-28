export function reduceWithState(state, values, f, initial) {
	return values.reduce(
		({result: acc, nextState: state}, v, i) => {
			console.assert(state);
			const {result, state: nextState} = f(acc, v, state, i);
			console.assert(nextState);
			return {result, nextState};
		},
		{result: initial, nextState: state}
	);
}

export function mapWithState(state, values, f) {
	return reduceWithState(
		state,
		values,
		(acc, v, state, i) => {
			const {result: v2, state: nextState} = f(v, state, i);
			return {result: [...acc, v2], state: nextState};
		},
		[]
	);
}

export function mapWithStateTakeLast(state, values, f) {
	return values.reduce(
		({state}, v, i) => {
			const {result, state: nextState} = f(v, state, i);
			console.assert(nextState);
			return {result, state: nextState};
		},
		{state}
	);
}
