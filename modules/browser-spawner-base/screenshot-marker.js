exports.width = 4;
exports.height = 4;
// exports.data = Buffer.from([
//     0x00, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0xff, 0x99, 0xd9, 0xea, 0xff, 0x99, 0xd9, 0xea, 0xff,
//     0x00, 0x00, 0x00, 0xff, 0xff, 0x7f, 0x27, 0xff, 0xff, 0x7f, 0x27, 0xff, 0x99, 0xd9, 0xea, 0xff,
//     0x99, 0xd9, 0xea, 0xff, 0xff, 0x7f, 0x27, 0xff, 0xff, 0x7f, 0x27, 0xff, 0x00, 0x00, 0x00, 0xff,
//     0x99, 0xd9, 0xea, 0xff, 0x99, 0xd9, 0xea, 0xff, 0x00, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0xff,
// ]);

const B = [0, 0, 0, 0xff];
const W = [0xff, 0xff, 0xff, 0xff];

exports.data = Buffer.from([].concat(
    B, W, B, B,
    B, W, B, W,
    W, B, W, B,
    B, W, B, W,

));

exports.base64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAbSURBVBhXYwCC////gygIgHBAJIIFAVD+//8A4WAU7De8PqQAAAAASUVORK5CYII=';


/* [0, 0, 0, 255,        0, 0, 0, 255,        153, 217, 234, 255,   153, 217, 234, 255,
	0, 0, 0, 255,        255, 127, 39, 255,   255, 127, 39, 255,    153, 217, 234, 255,
	153, 217, 234, 255,  255, 127, 39, 255,   255, 127, 39, 255,    0, 0, 0, 255,
	153, 217, 234, 255,  153, 217, 234, 255,  0, 0, 0, 255,         0, 0, 0, 255
] */

// exports.base64 =
//     'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAAklEQVR4AewaftIAAAA5SURBVGNkYGD4zwAEM2++YgABJgYg+F+vzpC2zJYBBJhm3nzFAAPp6mIMTAxAMCvqMANj400GEAAAvQYMY6PVnIQAAAAASUVORK5CYII=';


