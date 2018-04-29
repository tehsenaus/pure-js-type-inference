import { fresh, createFunctionType, NUMBER_TYPE, createTypeVariable, allocTypeVariable, INITIAL_TYPE_VARIABLES_STATE } from '../src/types.pure';


describe('types', () => {
	describe('fresh', () => {
		const { typeVariables } = allocTypeVariable(INITIAL_TYPE_VARIABLES_STATE);
		const typeVarA = createTypeVariable(0, { bound: true });
		const typeVarB = createTypeVariable(1, { bound: true });

		it('replaces bound (universal) type variables with fresh (existential) variables', () => {
			const functionType = createFunctionType(
				[NUMBER_TYPE, typeVarA],
				{
					typeVariables: [typeVarA],
				}
			);

			const [freshType] = fresh(functionType, typeVariables);

			expect(freshType.toString()).toBe('Number -> #b');
		});

		it('does not replace bound type variables in return type', () => {
			const returnType = createFunctionType(
				[typeVarA, typeVarB],
				{
					typeVariables: [typeVarA, typeVarB],
				}
			);
			const functionType = createFunctionType(
				[typeVarA, returnType],
				{
					typeVariables: [typeVarA],
				}
			);

			const [freshType] = fresh(functionType, typeVariables);

			expect(freshType.toString({ verbose: true })).toBe('#b -> forall. #a #b => #a -> #b');
		});
	});
});
