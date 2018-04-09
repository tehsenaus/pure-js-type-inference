
export function mapWithState(state, values, f) {
	return values.reduce(({ result, nextState: state }, v, i) => {
		const { result: v2, state: nextState } = f(v, state, i);
		console.assert(v2 && nextState);
		return { result: [...result, v2], nextState };
	}, { result: [], nextState: state });
}

export function mapWithStateTakeLast(state, values, f) {
	return values.reduce(({ state }, v, i) => {
		const { result, state: nextState } = f(v, state, i);
		console.assert(nextState);
		return { result, state: nextState };
	}, { state });
}
