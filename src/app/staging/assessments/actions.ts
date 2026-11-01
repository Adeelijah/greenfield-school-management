'use server';
import {runStagingAssessmentReview} from '@/server/academics/assessment-review-staging-entry';
import {saveStagingAssessmentScores} from '@/server/academics/assessment-score-staging-entry';
export async function saveAssessmentSubjectScores(command:unknown){return saveStagingAssessmentScores(command);}

export async function runAssessmentSubjectReview(command:unknown){return runStagingAssessmentReview(command);}
