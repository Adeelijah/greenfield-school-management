export type AcademicLevel = {
  id: string;
  name: string;
  stage: 'creche' | 'nursery' | 'primary';
  order: number;
  sections: readonly { id: string; name: string }[];
};

export type ClassStructure = {
  schoolId: string;
  levels: readonly AcademicLevel[];
  finalLevelId: string;
};

export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: string[] };

export function validateClassStructure(
  structure: ClassStructure
): ValidationResult {
  const errors: string[] = [];

  if (!structure.schoolId.trim()) {
    errors.push('School identifier is required.');
  }

  if (structure.levels.length === 0) {
    errors.push('Add at least one academic level.');
  }

  const ids = new Set<string>();
  const names = new Set<string>();
  const orders = new Set<number>();
  let previousStage = -1;

  for (const level of structure.levels) {
    const stageIndex = ['creche', 'nursery', 'primary'].indexOf(level.stage);
    if (stageIndex < 0) errors.push('Only Creche, Nursery and Primary stages are supported.');
    if (stageIndex < previousStage) errors.push('Stages must progress from Creche to Nursery to Primary.');
    previousStage = stageIndex;
    if (!Number.isInteger(level.order) || level.order < 0 || orders.has(level.order)) errors.push('Level progression orders must be unique non-negative integers.');
    orders.add(level.order);
    const sectionIds = new Set<string>();
    const sectionNames = new Set<string>();
    if (!level.sections.length) errors.push('Each level needs at least one section.');
    for (const section of level.sections) {
      if (!section.id.trim() || section.id !== section.id.trim() || !section.name.trim() || section.name.length > 80 || sectionIds.has(section.id) || sectionNames.has(section.name.trim().toLowerCase())) errors.push(`Invalid or duplicate section in ${level.name}.`);
      sectionIds.add(section.id);
      sectionNames.add(section.name.trim().toLowerCase());
    }
    const id = level.id.trim();
    const name = level.name.trim();
    const normalized = name.toLocaleLowerCase();

    if (!id) errors.push('Every level needs an identifier.');
    if (id !== level.id) errors.push('Level identifiers must not contain surrounding spaces.');
    if (!name) errors.push('Every level needs a name.');
    if (name.length > 80) errors.push('Level names must not exceed 80 characters.');

    if (ids.has(id)) errors.push(`Duplicate level identifier: ${id}`);
    if (names.has(normalized)) errors.push(`Duplicate level name: ${name}`);

    ids.add(id);
    names.add(normalized);
  }
  if (structure.levels.some((level, index) => index > 0 && level.order <= structure.levels[index - 1].order)) errors.push('Levels must follow their explicit progression order.');

  const finalIndex = structure.levels.findIndex(
    level => level.id === structure.finalLevelId
  );

  if (finalIndex === -1) {
    errors.push('Choose a valid final academic level.');
  } else if (finalIndex !== structure.levels.length - 1) {
    errors.push('The final academic level must be last in the progression.');
  }
  if (finalIndex >= 0 && (structure.levels[finalIndex].stage !== 'primary' || !/^Primary [56]$/i.test(structure.levels[finalIndex].name.trim()))) errors.push('The final academic level must be Primary 5 or Primary 6.');

  return errors.length
    ? { valid: false, errors: [...new Set(errors)] }
    : { valid: true };
}

export function nextAcademicLevel(
  structure: ClassStructure,
  currentLevelId: string
): AcademicLevel | null {
  if (!validateClassStructure(structure).valid) return null;

  const index = structure.levels.findIndex(
    level => level.id === currentLevelId
  );

  if (index < 0 || index >= structure.levels.length - 1) return null;

  return structure.levels[index + 1];
}
