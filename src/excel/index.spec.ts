import {
  exportToBuffer,
  exportToFile,
  exportToResponse,
} from './excel.service';
import { unlinkSync, existsSync } from 'node:fs';
import { stat as fsStat } from 'node:fs/promises';
import { join } from 'node:path';
import type { ServerResponse } from 'node:http';

describe('exportToBuffer', () => {
  it('should export data to an Excel buffer', async () => {
    const data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];

    const buffer = await exportToBuffer(data);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should handle empty data', async () => {
    const buffer = await exportToBuffer([]);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should pick specific columns via string array', async () => {
    const data = [
      { name: 'Alice', age: 30, email: 'alice@test.com' },
      { name: 'Bob', age: 25, email: 'bob@test.com' },
    ];

    const buffer = await exportToBuffer(data, {
      columns: ['name', 'email'],
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should use custom column definitions', async () => {
    const data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];

    const buffer = await exportToBuffer(data, {
      sheetName: 'Users',
      columns: [
        { key: 'name', header: 'Full Name', width: 30 },
        { key: 'age', header: 'Age', width: 10 },
      ],
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should apply per-column formatter', async () => {
    const data = [
      { name: 'Alice', salary: 50000 },
      { name: 'Bob', salary: 60000 },
    ];

    const buffer = await exportToBuffer(data, {
      columns: [
        { key: 'name' },
        {
          key: 'salary',
          header: 'Salary',
          formatter: (v) => `$${(v as number).toLocaleString()}`,
        },
      ],
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should apply global formatters', async () => {
    const data = [
      { name: 'Alice', role: 'admin', active: true },
      { name: 'Bob', role: 'user', active: false },
    ];

    const buffer = await exportToBuffer(data, {
      columns: ['name', 'role', 'active'],
      formatters: {
        active: (v) => (v ? 'Yes' : 'No'),
        role: (v) => String(v).toUpperCase(),
      },
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe('exportToFile', () => {
  const tmpPath = join(__dirname, '__test_export.xlsx');

  afterEach(() => {
    if (existsSync(tmpPath)) unlinkSync(tmpPath);
  });

  it('should write file to disk', async () => {
    const data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];

    await exportToFile(data, tmpPath);
    expect(existsSync(tmpPath)).toBe(true);

    const info = await fsStat(tmpPath);
    expect(info.size).toBeGreaterThan(0);
  });
});

describe('exportToResponse', () => {
  it('should set headers and call end with buffer', async () => {
    const data = [{ name: 'Alice', age: 30 }];

    const headers: Record<string, string | number> = {};
    let sentBuffer: Buffer | undefined;

    const fakeRes = {
      setHeader(name: string, value: string | number) {
        headers[name] = value;
      },
      end(buf: Buffer) {
        sentBuffer = buf;
      },
    } as ServerResponse;

    await exportToResponse(data, fakeRes, 'users.xlsx');

    expect(headers['Content-Type']).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(headers['Content-Disposition']).toBe(
      'attachment; filename="users.xlsx"',
    );
    expect(headers['Content-Length']).toBeGreaterThan(0);
    expect(sentBuffer).toBeInstanceOf(Buffer);
    expect(sentBuffer!.length).toBeGreaterThan(0);
  });

  it('should use default filename when not provided', async () => {
    const data = [{ name: 'Alice' }];

    const headers: Record<string, string | number> = {};
    const fakeRes = {
      setHeader(name: string, value: string | number) {
        headers[name] = value;
      },
      end() {},
    } as ServerResponse;

    await exportToResponse(data, fakeRes);
    expect(headers['Content-Disposition']).toBe(
      'attachment; filename="export.xlsx"',
    );
  });
});
