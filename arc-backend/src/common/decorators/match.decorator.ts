import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function Match(
  property: string,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'Match',
      target: target.constructor,
      propertyName: propertyName.toString(),
      constraints: [property],
      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          /* eslint-disable @typescript-eslint/no-unsafe-member-access */
          /* eslint-disable @typescript-eslint/no-unsafe-assignment */

          const relatedProperty = args.constraints[0];
          const relatedValue = (args.object as Record<string, unknown>)[
            relatedProperty
          ];

          return value === relatedValue;

          /* eslint-enable */
        },
      },
    });
  };
}
