'use server';
import {saveStagingAssessmentScores} from '@/server/academics/assessment-score-staging-entry';
export async function saveAssessmentSubjectScores(command:unknown){return saveStagingAssessmentScores(command);}
