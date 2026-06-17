# nesthub/excel

Export JSON data to Excel (.xlsx) — fast, zero boilerplate.

## Installation

```bash
npm install nesthub exceljs
```

## Functions

### `exportToBuffer(data, options?)`

Returns a `Buffer` of the .xlsx file.

```typescript
import { exportToBuffer } from 'nesthub/excel';

const data = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 },
];

const buffer = await exportToBuffer(data);
```

### `exportToFile(data, filePath, options?)`

Writes the .xlsx directly to disk.

```typescript
import { exportToFile } from 'nesthub/excel';

await exportToFile(data, './reports/users.xlsx');
```

### `exportToResponse(data, res, filename?, options?)`

Sends the .xlsx as a download response in a NestJS/Express controller.

```typescript
import { exportToResponse } from 'nesthub/excel';
import { Response } from 'express';
import { Controller, Get, Res } from '@nestjs/common';

@Controller('reports')
export class ReportController {
  @Get('users')
  async downloadUsers(@Res() res: Response) {
    const data = await this.userService.findAll();
    await exportToResponse(data, res, 'users.xlsx');
  }
}
```

## Options

| Param | Type | Default |
|-------|------|---------|
| `data` | `Record<string, unknown>[]` | — |
| `options.sheetName` | `string` | `'Sheet1'` |
| `options.columns` | `(string \| ExcelColumn)[]` | All keys from the first data object |
| `options.useAutoFilter` | `boolean` | `true` |
| `options.headerFont` | `{ name, size, bold }` | `{ name: 'Calibri', size: 11, bold: true }` |
| `options.headerBg` | `string` (ARGB hex) | `'4472C4'` |
| `options.borderColor` | `string` (ARGB hex) | `'B0B0B0'` |
| `options.formatters` | `Record<string, (value, row) => any>` | — |

### `ExcelColumn`

```typescript
interface ExcelColumn {
  key: string;                                         // field name in data
  header?: string;                                     // default: capitalize(key)
  width?: number;                                      // default: 18
  formatter?: (value: unknown, row: object) => unknown; // transform cell value
}
```

## Examples

### Pick fields to export

```typescript
await exportToBuffer(data, {
  columns: ['name', 'email'],
});
```

### Custom header + column width

```typescript
await exportToBuffer(data, {
  columns: [
    { key: 'name',   header: 'Full Name', width: 25 },
    { key: 'salary', header: 'Salary',    width: 15 },
  ],
});
```

### Format displayed values

**Per-column formatter:**
```typescript
await exportToBuffer(data, {
  columns: [
    { key: 'name' },
    {
      key: 'salary',
      header: 'Salary',
      formatter: (v) => `$${(v as number).toLocaleString()}`,
    },
  ],
});
```

**Global formatters:**
```typescript
await exportToBuffer(data, {
  columns: ['name', 'active'],
  formatters: {
    active: (v) => (v ? 'Active' : 'Inactive'),
  },
});
```

### Disable auto filter

```typescript
await exportToBuffer(data, { useAutoFilter: false });
```
