# SPDX-License-Identifier: MIT
component "Common" {
  field "id" {
    type = "int"
  }
  field "Name" {
    type = "string"
  }
  field "target" {
    record = "m.Target"
  }
  field "nested" {
    component = "Node"
  }
}
component "Other" {
  field "Name" {
    type = "int"
  }
}
component "Node" {
  field "self" {
    component = "Node"
  }
}
record "Thing" {
  use = ["Common", "m.Common", "Common"]
  key = ["id"]
}
record "Target" {
  key = ["id"]
  field "id" {
    type = "int"
  }
}
record "Override" {
  use = ["Common", "Other"]
  field "Name" {
    type = "string"
  }
}
