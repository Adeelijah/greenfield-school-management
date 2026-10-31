'use server';
import {readStagingAttendance,saveStagingAttendance} from '@/server/attendance/staging-attendance-entry';
export async function loadAttendanceRegister(selector:unknown){return readStagingAttendance(selector);}
export async function saveAttendanceRegister(command:unknown){return saveStagingAttendance(command);}
