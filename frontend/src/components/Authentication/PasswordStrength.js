import { Box, Text, Flex, Progress } from "@chakra-ui/react";

const PasswordStrength = ({ password }) => {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  const passedChecks = Object.values(checks).filter(Boolean).length;
  const strength = (passedChecks / 5) * 100;

  const getStrengthColor = () => {
    if (strength <= 20) return "red";
    if (strength <= 40) return "orange";
    if (strength <= 60) return "yellow";
    if (strength <= 80) return "blue";
    return "green";
  };

  const getStrengthText = () => {
    if (strength <= 20) return "Very Weak";
    if (strength <= 40) return "Weak";
    if (strength <= 60) return "Fair";
    if (strength <= 80) return "Good";
    return "Strong";
  };

  const getStrengthEmoji = () => {
    if (strength <= 20) return "😟";
    if (strength <= 40) return "😕";
    if (strength <= 60) return "😐";
    if (strength <= 80) return "🙂";
    return "💪";
  };

  if (!password) return null;

  return (
    <Box
      mt={2}
      p={3}
      bg="rgba(255, 255, 255, 0.05)"
      borderRadius="xl"
      border="1px solid rgba(255, 255, 255, 0.1)"
    >
      {/* Strength Bar */}
      <Flex align="center" gap={2} mb={2}>
        <Progress
          value={strength}
          colorScheme={getStrengthColor()}
          size="sm"
          borderRadius="full"
          flex="1"
          bg="rgba(255, 255, 255, 0.1)"
          sx={{
            "& > div": {
              transition: "all 0.3s ease",
            },
          }}
        />
        <Text fontSize="lg">{getStrengthEmoji()}</Text>
      </Flex>

      {/* Strength Text */}
      <Flex justify="space-between" align="center" mb={2}>
        <Text fontSize="xs" color="gray.500">
          Password Strength:
        </Text>
        <Text
          fontSize="xs"
          fontWeight="600"
          color={`${getStrengthColor()}.400`}
        >
          {getStrengthText()}
        </Text>
      </Flex>

      {/* Requirements Checklist */}
      <Flex flexWrap="wrap" gap={1}>
        <RequirementBadge met={checks.length} text="8+ chars" />
        <RequirementBadge met={checks.uppercase} text="A-Z" />
        <RequirementBadge met={checks.lowercase} text="a-z" />
        <RequirementBadge met={checks.number} text="0-9" />
        <RequirementBadge met={checks.special} text="!@#$" />
      </Flex>
    </Box>
  );
};

const RequirementBadge = ({ met, text }) => (
  <Box
    px={2}
    py={1}
    borderRadius="full"
    bg={met ? "rgba(72, 187, 120, 0.2)" : "rgba(255, 255, 255, 0.05)"}
    border="1px solid"
    borderColor={met ? "green.500" : "rgba(255, 255, 255, 0.1)"}
    color={met ? "green.400" : "gray.500"}
    fontSize="xs"
    fontWeight="500"
    transition="all 0.2s"
  >
    {met ? "✓" : "○"} {text}
  </Box>
);

export default PasswordStrength;
