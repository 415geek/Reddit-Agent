from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def reply_approval_keyboard(reply_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("✅ Approve & Publish", callback_data=f"approve_reply:{reply_id}"),
            InlineKeyboardButton("✏️ Edit Reply", callback_data=f"edit_reply:{reply_id}"),
        ],
        [
            InlineKeyboardButton("⏭️ Skip", callback_data=f"skip_reply:{reply_id}"),
            InlineKeyboardButton("💾 Save Lead", callback_data=f"save_lead:{reply_id}"),
        ],
    ])


def post_approval_keyboard(post_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("✅ Approve & Publish", callback_data=f"approve_post:{post_id}"),
            InlineKeyboardButton("✏️ Edit Post", callback_data=f"edit_post:{post_id}"),
        ],
        [
            InlineKeyboardButton("⏭️ Skip", callback_data=f"skip_post:{post_id}"),
        ],
    ])


def lead_action_keyboard(lead_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("💾 Save Lead", callback_data=f"save_lead_direct:{lead_id}"),
            InlineKeyboardButton("❌ Dismiss", callback_data=f"dismiss_lead:{lead_id}"),
        ],
    ])


def confirm_keyboard(action: str, item_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("✅ Confirm", callback_data=f"confirm_{action}:{item_id}"),
            InlineKeyboardButton("❌ Cancel", callback_data=f"cancel_{action}:{item_id}"),
        ],
    ])
