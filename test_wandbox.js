fetch('https://wandbox.org/api/compile.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        code: '#include <stdio.h>\nint main(){printf("Hello");return 0;}',
        compiler: 'gcc-13.2.0-c'
    })
}).then(r=>r.json()).then(console.log).catch(console.error);
