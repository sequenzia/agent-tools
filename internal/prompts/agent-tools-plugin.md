A new agent skill named `create-skill` that helps the user create new agent skills. This "meta-skill" should work for producing skills for the following AI coding agents:

- Generic Agent Skills based on this spec: https://agentskills.io/specification
- OpenCode Agent Skills based on this documentation: https://opencode.ai/docs/skills
- Codex Agent Skills based on this documentation: https://developers.openai.com/codex/skills

The `create-skill` skill should start by asking the user for the name of the new skill and a brief description of what the skill does and the coding agent it is intended for. Once the user provides this information, the skill should generate conduct an interactive adaptive interview with the user to identify the key features and functionalities of the new skill. 

The interview should include questions about the target audience, the main use cases, and any specific requirements or constraints for the skill. During the interview process the system should be able to do detailed research on topics if needed to help the user create a well-informed and comprehensive skill outline.

After gathering all the necessary information, the `create-skill` skill should generate a detailed outline of the new skill, including its name, description, key features, and potential use cases. The outline should be presented to the user in a clear and organized format, allowing them to easily review, make any necessary adjustments themselves or provide feedback for further refinement. After the user approves the outline the skill should create the new skill.