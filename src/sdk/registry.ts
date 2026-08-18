import type { Surface, ToyDefinition } from './types';

const toys = new Map<string, ToyDefinition>();

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Add a toy to the shelf.
 *
 * Built-in toys register themselves from src/toys/index.ts. The id doubles as
 * the hash route, so it has to be kebab-case and unique.
 */
export function registerToy<S extends Surface>(definition: ToyDefinition<S>): void {
  if (!ID_PATTERN.test(definition.id)) {
    throw new Error(
      `Trinket: toy id "${definition.id}" must be kebab-case, for example "lava-lamp".`,
    );
  }
  if (toys.has(definition.id)) {
    throw new Error(`Trinket: a toy with id "${definition.id}" is already registered.`);
  }
  const ids = new Set<string>();
  for (const control of definition.controls ?? []) {
    if (ids.has(control.id)) {
      throw new Error(
        `Trinket: toy "${definition.id}" declares two controls with id "${control.id}".`,
      );
    }
    ids.add(control.id);
  }
  toys.set(definition.id, definition as ToyDefinition);
}

/** Every registered toy, in registration order. */
export function allToys(): readonly ToyDefinition[] {
  return [...toys.values()];
}

export function getToy(id: string): ToyDefinition | undefined {
  return toys.get(id);
}

/** Test seam: drops every registration. */
export function clearToys(): void {
  toys.clear();
}
