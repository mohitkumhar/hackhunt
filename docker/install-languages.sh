#!/bin/sh
# Wait for Piston API to be ready
echo "Waiting for Piston API..."
until curl -s http://piston:2000/api/v2/runtimes > /dev/null 2>&1; do
  sleep 2
done
echo "Piston API is ready!"

# Install required language runtimes
LANGUAGES="python:3.10.0 javascript:18.15.0 c++:10.2.0 c:10.2.0 java:15.0.2 go:1.16.2"

for lang_ver in $LANGUAGES; do
  lang=$(echo "$lang_ver" | cut -d: -f1)
  ver=$(echo "$lang_ver" | cut -d: -f2)
  
  echo "Installing $lang $ver..."
  curl -s -X POST http://piston:2000/api/v2/packages \
    -H "Content-Type: application/json" \
    -d "{\"language\": \"$lang\", \"version\": \"$ver\"}" || true
  echo "Done with $lang"
done

echo "All languages installed!"
