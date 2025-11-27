
import os

backup_path = 'components/modals/FlightDetailModal.bak.tsx'
output_path = 'components/modals/FlightDetailModal.tsx'

with open(backup_path, 'r') as f:
    lines = f.readlines()

# Find Landing Buttons start (1324)
start_index = -1
for i, line in enumerate(lines):
    if "flightType === 'last'" in line and "isPastByTime" in line:
        start_index = i
        break

if start_index == -1:
    print("Could not find Landing Buttons start")
    exit(1)

# Find Landing Buttons end (1366)
end_index = -1
for i in range(start_index, len(lines)):
    if "착륙" in lines[i] and "</button>" in lines[i+1]:
        end_index = i + 4 # </div> </div> )}
        break

if end_index == -1:
    print("Could not find Landing Buttons end")
    exit(1)

# Find Delete Confirm start (1372)
delete_start_index = -1
for i in range(end_index, len(lines)):
    if "showDeleteConfirm &&" in lines[i]:
        delete_start_index = i
        break

if delete_start_index == -1:
    print("Could not find Delete Confirm start")
    exit(1)

# Find Delete Confirm end (1409)
delete_end_index = -1
for i in range(delete_start_index, len(lines)):
    if "⚠️ 최종 확인" in lines[i]: # Just to be sure we are inside
        pass
    if lines[i].strip() == ")}":
        # Check if it closes Delete Confirm
        # Delete Confirm has many closing tags.
        # It ends with </div> </div> )}
        if "</div>" in lines[i-1] and "</div>" in lines[i-2]:
             delete_end_index = i
             break

# Actually, we can just find the end of the file and work backwards
# But let's trust the backup structure for Delete Confirm
# In backup:
# 1409: )}
# 1410: </>
# 1411: );

# We will construct the new content:
# 1. Lines 0 to end_index (inclusive) -> Up to Landing Buttons end )}
# 2. Add </> and )} (Close 942-block)
# 3. Add </div> (Close 620)
# 4. Add </div> (Close 575)
# 5. Lines delete_start_index to delete_end_index (inclusive) -> Delete Confirm
# 6. Add </div> (Close 574)
# 7. Add </> (Close Fragment)
# 8. Add ); and }; and export

new_lines = lines[:end_index+1] # Up to 1366 )}

new_lines.append("                                                    </>\n")
new_lines.append("                                                )}\n")
new_lines.append("                                            </div>\n") # Close 620
new_lines.append("                                        </div>\n") # Close 575

# Add Delete Confirm
# We need to find exactly where it starts and ends in backup
# Backup:
# 1372: {showDeleteConfirm && (
# ...
# 1409: )}

# We can search for 1372
for i in range(end_index, len(lines)):
    if "showDeleteConfirm &&" in lines[i]:
        delete_start_index = i
        break

# We can search for 1409
for i in range(len(lines)-1, delete_start_index, -1):
    if lines[i].strip() == ")}":
        delete_end_index = i
        break

new_lines.extend(lines[delete_start_index:delete_end_index+1])

new_lines.append("                                    </div>\n") # Close 574
new_lines.append("                                </>\n") # Close Fragment
new_lines.append("                            );\n")
new_lines.append("};\n")
new_lines.append("\n")
new_lines.append("export default FlightDetailModal;\n")

with open(output_path, 'w') as f:
    f.writelines(new_lines)

print("Done")
