#!/bin/sh
grep -n -E " [A-Z][a-zA-Z]*\(" src/App.tsx > temp_calls.txt
