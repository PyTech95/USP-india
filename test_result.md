#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

## Responsive website / desktop-only Live Editor — current task
- User: "lets make it responsive"; editor only on desktop, not mobile or tablet.
- Scope: public website, preserve current desktop visual design and stored live edits. No data writes, no publishing, no placeholder removal, no auth/backend integration changes.
- First QA pass: READ-ONLY baseline to identify concrete overflow, clipped/overlapping fields, unusable menu/contact/notes layouts across all public pages at phone/tablet widths. Record desktop bounding/style baseline for later regression.
- Planned: responsive render-only geometry, navigation, section/grid/image layouts; viewport/input-capability gate for Live Editor including ?edit=1 and stored preference. Keep desktop drag/save controls intact.
- Existing credentials: /app/memory/test_credentials.md. Do not modify real pages or settings. Tests may use browser route interception / DOM-only responsive fixtures.


## Responsive implementation ready for verification
- Added styles/responsive.css using an important cascade layer: public free-form offsets/heights reflow below1440 or on touch devices; saved font sizes/crops stay intact. Desktop editor retains exact geometry.
- Coloured top-level sections use common boxed edges (screenshot Craft band); desktop Craft Centre text column bounded to correct offset origin.
- Responsive navigation <=1100/coarse input, Escape/outside/route close; touch targets, action wrapping, images, contact, notes dates and footer.
- LiveEditorProvider gates editing and dock by min1025px + hover + fine pointer. Separate enabled session preserves unsaved page/header/site drafts while resizing; no changes to auth or DB.
- QA: test prod fixture replay as well as preview; full phone/tablet/laptop sweeps + desktop baseline regression. No real data writes; use intercepted admin live data/save responses for editor tests, clearly mark test stubs. No deployment requested for this batch.

## Final responsive verification
- iterations28-29: all main responsive/editor/navigation/image fixes verified. No DB writes. QA-only edit/save stubs.
- Remaining iteration29 About 5px inset fixed by raising selector specificity in responsive.css.
- Main browser retest PASS at1024,1280,1440: About hero exactly aligns to footer rails. /app/test_reports/iteration_30.json.
- No open responsive product failures; no publishing performed for this batch. User requested completion without unrelated modifications.


## Laptop layout regression — user reported in preview
- User says laptop layout changed to mobile-like, menu strange, Field Notes arrangement different. Confirmed Preview (a). No redesign requested.
- Reproduced BEFORE fix:1280px fine pointer .hfn-head one1190px column + margin0;1080px fine pointer menu-toggle flex + one1004px notes column. Cause responsive.css max1439 layout reset + max1100 mobile menu.
- Fix scope: narrow responsive stacking/menu to <=960px OR primary coarse/no-hover; preserve existing laptop columns, geometry, spacing >=961px fine/hover. Editor remains desktop-only with existing min1025 capability gate (not part of bug change). No data writes or deployment.
- Test responsive sheet disabled IN BROWSER as old-layout reference for current preview data at laptop widths, versus fixed version; allow existing colored-band alignment/Craft Centre safeguards only. Do not equate no overflow with design fidelity. All8pages, particularly header/HomeFieldNotes/FieldNotes hero.

