import { CloseIcon } from "@chakra-ui/icons";
import { Badge, Flex, Text } from "@chakra-ui/react";

const UserBadgeItem = ({ user, handleFunction, admin }) => {
  return (
    <Badge
      px={3}
      py={2}
      borderRadius="full"
      m={1}
      variant="solid"
      fontSize="sm"
      bgGradient="linear(to-r, purple.500, pink.500)"
      color="white"
      cursor="pointer"
      onClick={handleFunction}
      display="flex"
      alignItems="center"
      gap={2}
      _hover={{
        bgGradient: "linear(to-r, purple.600, pink.600)",
        transform: "scale(1.05)",
        boxShadow: "md",
      }}
      transition="all 0.2s"
      boxShadow="sm"
    >
      <Text fontWeight="500">{user.name}</Text>
      {admin === user._id && (
        <Text
          fontSize="xs"
          bg="whiteAlpha.300"
          px={1.5}
          py={0.5}
          borderRadius="full"
        >
          👑 Admin
        </Text>
      )}
      <CloseIcon boxSize={2} />
    </Badge>
  );
};

export default UserBadgeItem;
