#!/bin/bash
# Wrapper script to run deployment and capture output

cd /Users/maria/dial-a-drink
LOG_FILE="/tmp/deployment-$(date +%Y%m%d-%H%M%S).log"

echo "🚀 Starting deployment..."
echo "📝 Log file: $LOG_FILE"
echo ""

# Run the deployment script and capture all output
bash deploy-to-development.sh 2>&1 | tee "$LOG_FILE"

echo ""
echo "✅ Deployment script completed!"
echo "📄 Check log file for details: $LOG_FILE"
echo ""
echo "Last 20 lines of log:"
tail -20 "$LOG_FILE"
