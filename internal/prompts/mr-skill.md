A new skill and subagents for reviewing Merge Requests (MRs) in GitLab. 

- This skill should dispatch subagents that perform the following tasks:
- Build a deep understanding of the existing codebase to have a solid foundation for reviewing the MR effectively.
- Do deep analysis of the MR, including code quality, potential bugs, and adherence to coding standards.
- Examine git history to understand the context of the changes proposed in the MR and how they fit into the overall project.

Once the subagents have completed their tasks, the main skill should compile their findings into a comprehensive review report. This report should include actionable feedback for the MR author, highlighting areas of improvement and suggesting potential solutions for any identified issues. The skill should also be able to create comments on the MR directly in GitLab, providing specific feedback on lines of code or sections of the MR as needed.

More details of the implementation:
- The user should be able to specify the MR they want to review by providing the MR URL or ID or have a list of MRs to choose from.
- The user should be able to provide notes to the skill to guide the review process, such as specific areas of concern or particular aspects of the code they want the skill to focus on during the review. These notes should be taken into account by the subagents when performing their analysis and should be reflected in the final review report and comments.
- The user should be able to choose between what the actions of the skill, the options should be "Produce a detailed review report" and "Create comments on the MR directly in GitLab". The skill should perform the selected action based on the user's choice. It should be able to do both actions if the user selects both options.
- The skill should use the `glab` CLI tool and the `glab` skill (@skills/glab) to interact with GitLab, fetch MR details, and post comments.