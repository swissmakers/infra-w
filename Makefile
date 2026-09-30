SHELL := /bin/bash

.PHONY: security-update security-audit security-all security-sbom

security-update:
	./scripts/ci-security.sh update

security-audit:
	./scripts/ci-security.sh audit

security-all:
	./scripts/ci-security.sh all

security-sbom:
	SECURITY_GENERATE_SBOM=1 ./scripts/ci-security.sh audit
