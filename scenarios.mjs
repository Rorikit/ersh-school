import {spawn} from 'node:child_process';
console.log('Используются независимые тестовые серверы и базы. Состояние чужого браузера не очищается.');
const child=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test'],{stdio:'inherit'});child.on('exit',code=>{process.exitCode=code??1});
