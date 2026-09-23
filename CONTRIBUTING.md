# Contributing to LiteLens

Thank you for your interest in improving LiteLens.

## Development Workflow

1. Fork the repository on GitHub.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/litelens.git
   cd litelens
   ```
3. Create a feature branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```
4. Install frontend dependencies:
   ```bash
   cd ui && npm install && cd ..
   ```
5. Run the Go test suite:
   ```bash
   go test ./...
   ```
6. Make your changes and test them locally.
7. Commit your changes using conventional commit messages:
   - `feat(scope): add new capability`
   - `fix(scope): resolve bug`
   - `refactor(scope): internal code restructuring`
   - `docs(scope): documentation updates`
8. Push your branch to GitHub and open a Pull Request.

## Code Standards

* **Backend:** Format Go code using `gofmt` and ensure `golangci-lint` passes without warnings. Keep dependencies minimal and avoid CGO requirements.
* **Frontend:** Format TypeScript and React code using standard formatting rules. Ensure `npm run build` succeeds without type errors.
* **Commit Messages:** Follow conventional commits in English.
