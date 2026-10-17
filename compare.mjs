import {spawn} from 'node:child_process';
const child=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test','-g','Визуальная регрессия'],{stdio:'inherit'});child.on('exit',code=>{process.exitCode=code??1});
