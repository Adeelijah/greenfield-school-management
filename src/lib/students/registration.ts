import { z } from 'zod';

const optionalDate = z.union([
  z.iso.date(),
  z.literal(''),
  z.null(),
]).optional();

export function createStudentRegistrationSchema(today: () => string = () => new Date().toISOString().slice(0, 10)) {
  return z.object({
    admissionNumber: z.string().trim().min(1).max(50),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    dateOfBirth: optionalDate,
  }).strict().superRefine((value, context) => {
    if (value.dateOfBirth && value.dateOfBirth > today()) {
      context.addIssue({ code: 'custom', path: ['dateOfBirth'], message: 'Date of birth cannot be in the future.' });
    }
  });
}

export const studentRegistrationSchema = createStudentRegistrationSchema();

export type StudentRegistrationInput =
  z.infer<typeof studentRegistrationSchema>;
