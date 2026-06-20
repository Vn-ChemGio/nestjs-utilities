# Contributing to nesthub

Thank you for considering contributing to nesthub!

## Development

```bash
npm install
npm run build
npm test
```

## Project structure

Each module lives under `src/<module>/` and is exported via sub-path exports defined in `package.json`. When adding a new module:

1. Create `src/<module>/` with your code
2. Add the sub-path export to `package.json`
3. Add README at `src/<module>/README.md`
4. Add the README path to `files` array and `build` script in `package.json`

## Pull requests

- Keep changes focused — one feature/fix per PR
- Add or update tests as needed
- Run `npm run lint` before committing
- Update the relevant README if adding options

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
