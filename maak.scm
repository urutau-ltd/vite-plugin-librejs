(define-module (maak)
  #:declarative? #t
  #:use-module (maak maak))

(define %deno "deno")

(define (run-deno . args)
  "Deno arguments helper"
  ($ (cons %deno args)))

(define (fmt)
  "Format sources with deno fmt"
  (log-info "Formatting source...")
  (run-deno "fmt"))

(define (fmt-check)
  "Verify formatting without writing."
  (run-deno "fmt" "--check"))

(define (lint)
  "Run deno lint."
  (run-deno "lint"))

(define (check)
  "Type-check sources and JSDoc code blocks."
  (run-deno "check" "--doc"))

(define (test)
  "Run the plugin unit tests with the minimal permission set."
  (run-deno "test" "-P"))

(define (ci)
  "Full pipeline with coverage."
  (fmt-check)
  (lint)
  (check)
  (run-deno "test" "-P" "--coverage=coverage")
  (run-deno "coverage" "coverage"))

(define (publish-dry)
  "Validate the package without uploading."
  (run-deno "publish" "--dry-run"))

(define (publish)
  "Publish to JSR after the full pipeline."
  (default)
  (run-deno "publish"))

(define (clean)
  "Remove coverage output."
  (delete-file-recursively "coverage"))

(define (default)
  "fmt-check + lint + check + test."
  (fmt-check)
  (lint)
  (check)
  (test))