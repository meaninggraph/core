# SPDX-License-Identifier: MIT
component "KeyParts" {
  field "field-name" {
    type = "int"
  }
  field "a.b" {
    type = "int"
  }
  field "部分" {
    type = "int"
  }
  field "﻿" {
    type = "int"
  }
}
record "Target" {
  key = ["id"]
  field "id" {
    type = "int"
  }
}
record "Order-Line" {
  field "target" {
    record = "Target"
  }
}
record "_Record" {
  field "target" {
    record = "Target"
  }
}
record "Thing?ref=abc" {
  field "target" {
    record = "Target"
  }
}
record "IncomingFields" {
  field "field-name" {
    record = "Target"
  }
  field "a.b" {
    record = "Target"
  }
  field "部分" {
    record = "Target"
  }
  field "﻿" {
    record = "Target"
  }
}
record "InheritedKey" {
  use = ["KeyParts"]
  key = ["field-name", "a.b", "部分", "﻿"]
}
record "Unrelated-Broad" {
  field "field-name" {
    type = "string"
  }
}
