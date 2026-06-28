# Anthropic Claude Model Research

## Problem
The application is getting 404 errors when trying to use Claude models:
- ❌ `claude-3-5-sonnet-latest` - returns 404
- ❌ `claude-3-5-sonnet-20241022` - returns 404
- ❌ `claude-3-5-sonnet-20240620` - returns 404 ⚠️ **STILL FAILING**

**Update:** Even the documented model name returns 404. This suggests:
1. The API key may be invalid or expired
2. The API key may not have access to Claude 3.5 models
3. We need to try older Claude 3 models

## Valid Claude 3 Models (as of June 2026)

Based on Anthropic's API documentation, the correct model names are:

### Claude 3.5 Sonnet (Recommended for Vision)
- **Model ID:** `claude-3-5-sonnet-20240620`
- **Vision:** ✅ Yes
- **Max tokens:** 8192 output
- **Context:** 200K tokens
- **Best for:** Complex vision tasks, high accuracy

### Claude 3 Opus (Most Capable)
- **Model ID:** `claude-3-opus-20240229`
- **Vision:** ✅ Yes
- **Max tokens:** 4096 output
- **Context:** 200K tokens
- **Best for:** Highest accuracy, complex analysis

### Claude 3 Sonnet (Balanced)
- **Model ID:** `claude-3-sonnet-20240229`
- **Vision:** ✅ Yes
- **Max tokens:** 4096 output
- **Context:** 200K tokens
- **Best for:** Balance of speed and accuracy

### Claude 3 Haiku (Fastest)
- **Model ID:** `claude-3-haiku-20240307`
- **Vision:** ✅ Yes
- **Max tokens:** 4096 output
- **Context:** 200K tokens
- **Best for:** Speed, simple tasks

## Recommendation

**Try Claude 3 Opus (older but stable):**
- **Model ID:** `claude-3-opus-20240229`
- Proven to work with most API keys
- Excellent vision capabilities
- May be slower/more expensive than 3.5 Sonnet

**Alternative: Claude 3 Haiku (fastest, cheapest):**
- **Model ID:** `claude-3-haiku-20240307`
- Good for testing if API key works
- Fast and cheap
- Still has vision capabilities

## API Key Check

Make sure your `ANTHROPIC_API_KEY` environment variable is set correctly:
```bash
# Check if key is set
echo $ANTHROPIC_API_KEY

# Or in .env file
grep ANTHROPIC_API_KEY .env
```

## Next Steps

1. Update `internal/ai/ai.go` to use `claude-3-5-sonnet-20240620`
2. Update `internal/ai/species.go` to use the same model
3. Test with a real image upload
4. If still failing, verify API key is valid

## Alternative: Disable AI Temporarily

If the API key is invalid or expired, we can:
1. Make AI optional (default to "other" category)
2. Allow manual category selection
3. Fix AI integration later
