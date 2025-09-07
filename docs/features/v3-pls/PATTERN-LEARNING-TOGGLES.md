# Pattern Learning Configuration Toggles

## Overview
The V3-PLS Stats & Settings page now includes toggles to control the automatic pattern learning system directly from the UI.

## Location
1. Navigate to **Operations** → **V3-PLS** page
2. Click on the **Stats & Settings** tab
3. Look for the **Pattern Learning System** section (purple Brain icon)

## Available Controls

### 1. Enable Pattern Learning
- **Toggle**: On/Off switch
- **Purpose**: Master control for the entire pattern learning system
- **Default**: OFF (disabled)
- **Effect**: When enabled, the system will automatically learn from operator responses

### 2. Shadow Mode
- **Toggle**: On/Off switch  
- **Purpose**: Test pattern learning without creating actual patterns
- **Default**: OFF
- **Effect**: 
  - When ON: System logs learning opportunities but doesn't create patterns
  - When OFF: System actively creates new patterns from operator responses
- **Note**: Only available when Pattern Learning is enabled

### 3. Minimum Confidence to Suggest
- **Control**: Slider (0-100%)
- **Default**: 60%
- **Purpose**: Sets the threshold for when patterns are suggested to operators
- **Effect**: Patterns with confidence above this level will be shown as suggestions

### 4. Minimum Confidence to Auto-Execute
- **Control**: Slider (0-100%)
- **Default**: 85%
- **Purpose**: Sets the threshold for automatic pattern execution
- **Effect**: Patterns with confidence above this level can respond automatically
- **Important**: Set this high (85%+) for safety

### 5. Minimum Occurrences to Learn
- **Control**: Number input (1-10)
- **Default**: 1
- **Purpose**: How many similar responses needed before creating a pattern
- **Effect**: Higher values = more conservative learning

## Visual Indicators

### Status Indicator
- **Green pulsing dot**: Pattern learning is active
- **Gray dot**: Pattern learning is disabled

### Status Messages
- ✅ **"System is actively learning from operator responses"** - Full learning enabled
- ⚠️ **"Shadow mode enabled - patterns are logged but not created"** - Test mode
- **"Enable pattern learning to automatically create patterns"** - System disabled

## How to Enable Pattern Learning

1. **Navigate to Settings**
   - Go to Operations → V3-PLS → Stats & Settings

2. **Enable Pattern Learning**
   - Toggle "Enable Pattern Learning" to ON
   - The status indicator will turn green and pulse

3. **Configure Thresholds**
   - Set "Minimum Confidence to Suggest" to 60% (recommended)
   - Set "Minimum Confidence to Auto-Execute" to 85% (recommended)
   - Set "Minimum Occurrences to Learn" to 1 for aggressive learning

4. **Disable Shadow Mode**
   - Ensure "Shadow Mode" is OFF for actual pattern creation
   - Keep it ON if you want to test without creating patterns

5. **Save Settings**
   - Click the "Save Settings" button at the bottom
   - Wait for the green success message

## Verification

### Check if Working
Run this SQL query to verify settings:
```sql
SELECT config_key, config_value 
FROM pattern_learning_config 
WHERE config_key IN ('enabled', 'shadow_mode');
```

Expected result for active learning:
- `enabled`: 'true'
- `shadow_mode`: 'false'

### Monitor Pattern Creation
Check for new patterns:
```sql
SELECT COUNT(*) as new_patterns
FROM decision_patterns
WHERE created_at > NOW() - INTERVAL '24 hours';
```

## Recommended Settings

### For Initial Testing
- Enable Pattern Learning: **ON**
- Shadow Mode: **ON** (test without creating patterns)
- Min Confidence to Suggest: **50%**
- Min Confidence to Act: **95%**
- Min Occurrences: **2**

### For Production Use
- Enable Pattern Learning: **ON**
- Shadow Mode: **OFF**
- Min Confidence to Suggest: **60%**
- Min Confidence to Act: **85%**
- Min Occurrences: **1**

### Conservative Approach
- Enable Pattern Learning: **ON**
- Shadow Mode: **OFF**
- Min Confidence to Suggest: **70%**
- Min Confidence to Act: **95%**
- Min Occurrences: **3**

## Troubleshooting

### Patterns Not Being Created
1. Check Pattern Learning is enabled
2. Verify Shadow Mode is OFF
3. Ensure OpenPhone webhook is configured
4. Check for operator responses in last 24h

### Too Many Low-Quality Patterns
1. Increase "Min Confidence to Suggest" to 70%+
2. Increase "Min Occurrences to Learn" to 2-3
3. Review and delete poor patterns manually

### System Not Learning Fast Enough
1. Decrease "Min Occurrences to Learn" to 1
2. Lower "Min Confidence to Suggest" to 50%
3. Ensure operators are responding naturally (not using templates)

## Security Notes

- Only admins can change pattern learning configuration
- All patterns start as inactive (`is_active = false`) for safety
- Operators must manually enable each new pattern
- High confidence thresholds prevent risky auto-responses
- Blacklist topics always override pattern learning

## Integration with OpenPhone

Pattern learning requires:
1. OpenPhone webhook configured to your backend URL
2. Operators responding via OpenPhone (not automated)
3. Messages without [Automated] tags or 🤖 emoji

## Database Tables Affected

- `pattern_learning_config` - Stores all configuration settings
- `decision_patterns` - Where new patterns are created
- `pattern_execution_history` - Logs pattern usage
- `conversation_messages` - Source data for learning