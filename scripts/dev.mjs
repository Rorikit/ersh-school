import { spawn } from 'node:child_process';
const children = [spawn(process.execPath,['server/index.ts','--demo'],{stdio:'inherit'}),spawn(process.execPath,['node_modules/vite/bin/vite.js'],{stdio:'inherit'})];
let closing=false;
function close(code=0){if(closing)return;closing=true;process.exitCode=code;for(const child of children)child.kill()}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>close());
for(const child of children)child.on('exit',code=>close(code??1));
